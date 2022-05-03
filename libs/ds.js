const security = require('./security');
const Mode = require('./Mode');
const Consts = require('./Consts');
const tag = require('./tag');
const express = require('express');
const router = express.Router();
const ddb = require('../vendor/ddb');
const Directories = require('./Directories');
const path = require('path');
const { formDataParser } = require('./parsers');
const { getDDBPath } = require('./middleware');

const ddbUrlFromReq = (req) => {
    return `${req.secure ? "ddb" : "ddb+unsafe"}://${req.headers.host}/${req.params.org}/${req.params.ds}`;
}

const getThumbSourceFilePath = (entry) => {
    if (entry.type === ddb.entry.type.POINTCLOUD) return `.ddb/build/${entry.hash}/ept/ept.json`;
    else return entry.path;
};

const getTileSourceFilePath = (entry) => {
    if (entry.type === ddb.entry.type.POINTCLOUD) return `.ddb/build/${entry.hash}/ept/ept.json`;
    else if (entry.type === ddb.entry.type.GEORASTER) return `.ddb/build/${entry.hash}/cog/cog.tif`;
    else return entry.path;
};

router.get('/orgs/:org/ds', security.allowOrgOwnerOrPublicOrgOnly, async (req, res) => {
    if (Mode.singleDB){
        // Single database
        const info = await ddb.info(Directories.singleDBPath, { withHash: false, stoponError: true });
        const name = path.basename(info[0].path);
        res.json([{
            slug: tag.filterComponentChars(name.length ? name : 'default'),
            creationDate: Consts.startupTime.toISOString(),
            size: info[0].size,
            properties: info[0].properties
        }]);
        return;
    }

    const { org } = req.params;
   
    const orgDir = path.join(Directories.storagePath, org);

    // Path traversal check
    if (orgDir.indexOf(Directories.storagePath) !== 0){
        cb(new Error("Invalid path"));
        return;
    }

    fs.exists(orgDir, exists => {
        if (exists){
            fs.readdir(orgDir, { withFileTypes: true }, (err, files) => {
                if (err) res.status(400).json({error: err.message});
                else{
                    res.json(files.filter(f => f.isDirectory()).map(f => {
                        return {
                            slug: f.name,
                            creationDate: new Date(fs.statSync(path.join(orgDir, f.name)).ctime.getTime()).toISOString()
                            // name: path.basename(f)
                            // TODO: more?
                        };
                    }));
                }
            });
        }else{
            res.json([]);
        }
    });
});

router.get('/orgs/:org/ds/:ds', security.allowOrgOwnerOrPublicOrgOnly, async (req, res) => {
    if (Mode.singleDB){
        // Single database
        const info = await ddb.info(Directories.singleDBPath, { withHash: false, stoponError: true });
        info[0].depth = 0;
        info[0].path = ddbUrlFromReq(req);
        ddbUrlFromReq(req, info);
        res.json(info);
        return;
    }
});

router.post('/orgs/:org/ds/:ds/list', formDataParser, security.allowDatasetRead, getDDBPath, async (req, res) => {
    const paths = req.body.path ? [req.body.path.toString()] : ".";

    try{
        res.json(await ddb.list(req.ddbPath, paths));
    }catch(e){
        res.status(400).json({error: e.message});
    }
});

router.get('/orgs/:org/ds/:ds/thumb', security.allowDatasetRead, getDDBPath, async (req, res) => {
    try{
        if (!req.query.path) throw new Error("Invalid path");

        const thumbSize = parseInt(req.query.size) || 512;
        if (isNaN(thumbSize) || thumbSize < 1) throw new Error("Invalid size");

        const filePath = path.join(req.ddbPath, req.query.path);
        if (filePath.indexOf(req.ddbPath) !== 0) throw new Error("Invalid path");
        
        const entry = await ddb.get(req.ddbPath, req.query.path);
        const tsPath = path.join(req.ddbPath, getThumbSourceFilePath(entry));

        const thumbFile = await ddb.thumbs.getFromUserCache(tsPath, { thumbSize });
        res.sendFile(thumbFile);
    }catch(e){
        res.status(400).json({error: e.message});
    }
});

router.get('/orgs/:org/ds/:ds/tiles/:tz/:tx/:ty.png', security.allowDatasetRead, getDDBPath, async (req, res) => {
    try{
        if (!req.query.path) throw new Error("Invalid path");
        let { tz, tx, ty } = req.params;
        let tileSize = 256;
        
        tz = parseInt(tz);
        if (isNaN(tz)) throw new Error("Invalid tz");
        tx = parseInt(tx);
        if (isNaN(tx)) throw new Error("Invalid tx");

        if (typeof ty === "string"){
            if (ty.endsWith("@2x")){
                tileSize *= 2;
            }
        }
        ty = parseInt(ty);
        if (isNaN(ty)) throw new Error("Invalid ty");

        const filePath = path.join(req.ddbPath, req.query.path);
        if (filePath.indexOf(req.ddbPath) !== 0) throw new Error("Invalid path");

        const entry = await ddb.get(req.ddbPath, req.query.path);
        const tsPath = path.join(req.ddbPath, getTileSourceFilePath(entry));

        const tileFile = await ddb.tile.getFromUserCache(tsPath, tz, tx, ty, { tileSize, tms: true });
        res.sendFile(tileFile);
    }catch(e){
        res.status(400).json({error: e.message});
    }
});



module.exports = {
    api: router
}