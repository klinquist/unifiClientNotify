### UniFi New Client Notification

This nodejs app will send you a push notification whenever a new device is discovered on your UniFi-based network.   It uses redis to store previous clients. Redis is very efficient in memory (with disk persistence) key/value store.

It polls the unifi controller/cloud key every 30 seconds by default.




#### Pre-requisites:

* Redis
  
  * Install via `sudo apt-get install redis-server redis-tools` on most distros
  
  * Either set a password or turn `protected-mode off` in `/etc/redis.conf`.  After editing redis.conf, `sudo service redis-server restart`

* Pushover push notification service
  
  * Register on [https://pushover.net/](https://pushover.net/) & set up a new "app" for your new client notifications

* NodeJS ([https://nodejs.org/en/download/package-manager/](https://nodejs.org/en/download/package-manager/))

* `pm2` or similar nodejs process manager for automatic launch (optional)

#### Installation:

```bash
git clone https://github.com/klinquist/unifiClientNotify
cd unifiClientNotify
npm install
mv config.json.default config.json
```

Now you must edit the `config.json` with your redis server IP address (likely 127.0.0.1), Unifi (cloud key) IP address login & password, and your pushbullet user & app tokens.   Finally, launch via `npm start`.  Expect a flood of messages on the first run :). 


