# homebridge-mertik-fireplace
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![npm](https://img.shields.io/npm/v/homebridge-mertik-fireplace.svg)](https://www.npmjs.com/package/homebridge-mertik-fireplace) [![npm](https://img.shields.io/npm/dt/homebridge-mertik-fireplace.svg)](https://www.npmjs.com/package/homebridge-mertik-fireplace)

<img src="https://github.com/tritter/homebridge-mertik-fireplace/blob/master/.img/sample.jpg?raw=true" height=250 >
<img src="https://github.com/tritter/homebridge-mertik-fireplace/blob/master/.img/homekit.jpg?raw=true" height=250 >


[Homebridge](https://github.com/nfarina/homebridge) plugin for heating your place using the Mertik Fireplace WiFi controller.

## Features
With this plugin you can turn your fireplace on using Siri and schedule cosiness with your 'Cosy Time' Scene! The plugin exposes a Heater inside Homekit with the following features:

| Feature | Description |
|----------|----------|
|Lock Controls| Lock access to fireplace (for example when leaving home lock controls, turn off is always possible!) Switch Child Lock Unlocked/Locked |
|Temperature| Set the mode in HomeKit to AUTO. |
|Manual| Set the mode in HomeKit to HEAT. |
|Eco| Set the mode in HomeKit to COOL. |
|Aux| Switch On/Off using the Oscillate switch. |

### Install homebridge and this plugin
```
[sudo] npm install -g --unsafe-perm homebridge
[sudo] npm install -g --unsafe-perm homebridge-mertik-fireplace
```

## Homebridge configuration
Update your Homebridge `config.json` file.
```json
"platforms": [
        {
            "fireplaces": [
                {
                    "name": "Blast",
                    "ip": "192.168.1.111"
                }
            ],
            "platform": "MertikFireplace"
        }
    ],
```


| Key                     | Default         | Description                                                                                                                                                                                                 |
|-------------------------|-----------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `platform`|"MertikFireplace"| Mandatory. The name provided to Homebridge. |
| `fireplaces`|[]|Array of configured fireplaces, is needed if you want to connect to one one. (Multiple are supported)|
| `name`|"Blaster"| Mandatory. The name of the fireplace. Note: also used as serial, when changing the name a new instance will be created.
| `ip`|"192.168.1.111"| Mandatory. The plugin uses a fixed ip, make sure the device has a fixed one!

## Legal

*Mertik* is an registered trademarks of Maxitrol GmbH & Co. KG.

This project is in no way affiliated with, authorized, maintained, sponsored or endorsed by *Maxitrol* or any of its affiliates or subsidiaries.

## Credits
These users/repositories helped making the Homekit integration possible:

[@erdebee](https://github.com/erdebee/homey-mertik-wifi) - https://github.com/erdebee/homey-mertik-wifi

And me and yes, I like coffe @ a warm fireplace :)
<br>[<img src="https://github.com/tritter/homebridge-mertik-fireplace/blob/master/.img/coffee-button.png?raw=true" height=50 >](https://www.buymeacoffee.com/tritter)
