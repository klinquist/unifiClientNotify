const location = 'geekflat';

let locations;
try {
    locations = require('./config.json');
} catch (e) {
    throw new Error('Cannot read config.json (did you rename config.json.default to config.json and edit it?');
}



const waitSeconds = 300; //Number of seconds to wait before exiting. When using nodejs process managers, this keeps it from restarting immediately.
const checkEverySeconds = 30;




const unifi = require('node-unifi');
const async = require('async');
const lodash = require('lodash');
const Redis = require('ioredis');
const redisConfig = {
    host: locations[location].redisIP,
    port: 6379
};
if (locations[location].redisPassword) redisConfig.password = locations[location].redisPassword;
const redis = new Redis(redisConfig);
const prettyjson = require('prettyjson');
const controller = new unifi.Controller(locations[location].ubntIP, 8443);
const Push = require('pushover-notifications');
const p = new Push({
    user: locations[location].pbUser,
    token: locations[location].pbToken,
});



const log = (msg) => {
    console.log(`${new Date().toISOString()} ${msg}`);
};


let defaultSite;
const login = (cb) => {
    async.series([
        (cb) => {
            log('Logging in...');
            controller.login(locations[location].ubntLogin, locations[location].ubntPassword, (err) => {
                if (err) {
                    sendErrorAndExit('Error logging in', err);
                } else {
                    return cb();
                }
            });
        },
        (cb) => {
            log('Getting network sites...');
            controller.getSitesStats((err, sitesRet) => {
                defaultSite = sitesRet && sitesRet[0] && sitesRet[0].name;
                if (!defaultSite) throw new Error('Unable to get default site!');
                cb();
            });

        }
    ], (err) => {
        if (err) throw new Error(err);
        const msg = {
            message: 'Logged in to UniFi', // required
            title: err,
            sound: locations[location].pbNotificationSound,
            priority: 1
        };
        send(msg, cb);
    });
};


const getClients = (cb) => {
    controller.getClientDevices(defaultSite, (err, client_data) => {
        if (err) {
            sendErrorAndExit('Error getting devices', err);
        } else {
            const clients = client_data[0];
            const clientsByNetwork = lodash.countBy(clients, 'network');
            log('Clients by network: ' + prettyjson.render(clientsByNetwork));
            return cb(null, clients);
        }
    });
};



const checkForClients = (clients, cb) => {
    let newClients = false;
    async.each(clients, (client, cb) => {
        redis.setnx(client.mac, JSON.stringify(client), (err, res) => {
            if (res == 1) {
                newClients = true;
                notifyOfNewClient(client, cb);
            } else {
                return cb();
            }
        });
    }, (err) => {
        if (err) log(err);
        if (!newClients) log('No new clients found, waiting for next poll.');
        return cb();
    });
};


const notifyOfNewClient = (client, cb) => {
    log(`New client discovered: ${client.name || client.hostname}, mac: ${client.mac}, oui: ${client.oui}`);
    var msg = {
        message: `Hostname: ${client.name || client.hostname}, mac: ${client.mac} oui: ${client.oui}`,
        title: `New client detected on network ${client.network}`,
        sound: locations[location].pbNotificationSound,
        priority: 1
    };
    send(msg, cb);
};


const sendErrorAndExit = (errTitle, err) => {
    const msg = {
        message: errTitle, // required
        title: err,
        sound: locations[location].pbErrorSound,
        priority: 1
    };
    send(msg, () => {
        log(`Waiting ${waitSeconds} and exiting`);
        setTimeout(() => {
            process.exit(1);
        }, waitSeconds * 1000);
    });
};


const send = (msg, cb) => {
    p.send(msg, (err) => {
        if (err) return cb('Error sending push notification: ' + err);
        return cb();
    });
};


login(() => {
    log(`Logged in. Now waiting ${checkEverySeconds} seconds for next poll.`);
    setInterval(()=>{
        async.waterfall([
            (cb) => {
                getClients(cb);
            },
            (clients, cb) => {
                checkForClients(clients, cb);
            }
        ], (err) => {
            if (err) log(err);
        });
    }, checkEverySeconds * 1000);
});

