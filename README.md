# xml3d-4to5.js
A converter script to upgrade XML3D 4.x scenes to XML3D 5.x

#### Usage ####
This script requires [Node.js v4.x](https://nodejs.org/en/).

After checking out the repository (and installing Node.js if necessary) run the following command:

```bash
npm install
```

To convert an XML3D scene use the following command:

```bash
node xml3d-4to5.js <filename>
```

#### Limitations ####
This tool does not work with XML files, for example XML3D's XML asset format. These files will need to be adapted 
manually or re-exported using an [up-to-date exporter](https://github.com/xml3d/xml3d.js/wiki/Converting-models-to-XML3D).

The XML3D wiki has [a list of all non-compatible changes in XML3D 5.0](https://github.com/xml3d/xml3d.js/wiki/Migrate-to-XML3D-5.0) 
with instructions on how to adapt them.
