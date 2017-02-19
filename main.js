/**
 * Created by poxiaoge on 2017/1/16.
 */
const encoding = require('encoding');
const fs = require("fs");
const express = require("express");
var app = new express();
const fork = require("child_process").fork;

// options={
//     url:"http://images.ali213.net/picfile/pic/2017/01/06/927_2017010654625893.jpg",
//     headers:{
//         "User-Agent":"Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36"
//     }
// }


function GoodsItem(title,link,price,desc,seller) {
    this.title = title;
    this.link = link;
    this.price = price;
    this.desc = desc;
    this.seller = seller;
}

function KeyItem(sessionId,monitorInterval,goods,startPrice,endPrice){
    this.sessionId = sessionId;
    this.monitorInterval = monitorInterval;
    this.goods = goods;
    this.startPrice = startPrice;
    this.endPrice = endPrice;
    // this.divisionId = divisionId;
}

function SessionItem(sessionId,goodsItem,keyItem,childPid) {
    this.sessionId = sessionId;
    this.goodsItem = goodsItem;
    this.keyItem = keyItem;
    this.childPid = childPid;
}

function CmdItem(cmd,object) {
    this.cmd = cmd;
    this.object = object;
}

function get_key_array() {
    let key_array = [];
    current_session_map.forEach(function (val) {
        key_array.push(val);
    });
    return key_array;
}


var current_session_map = new Map();


var max_session = 4;


app.get("/", function (req, res) {
    res.send("hello");
});



app.get("/add-key", function (req, res) {
    let query = req.query;
    if (current_session_map.size <= max_session) {
        if (query.sessionId !== undefined && query.monitorInterval !== undefined && query.goods !== undefined && query.startPrice !== undefined
            && query.endPrice !== undefined) {
            let keyItem = new KeyItem(query.sessionId, query.monitorInterval, query.goods, query.startPrice, query.endPrice);
            let childProcess = fork("./monitor.js", [query.monitorInterval, query.goods, query.startPrice, query.endPrice]);
            let sessionItem = new SessionItem(query.sessionId, undefined, keyItem,childProcess.pid);
            childProcess.on("message", function (newGoods) {
                console.log("GoodsItem from child " + childProcess.pid + ":" + newGoods);
                sessionItem.goodsItem = newGoods;
            });
            childProcess.on("exit", function (code, signal) {
                console.log("child " + childProcess.pid + " exit in main.js" + " & signal is :" + signal);
            });

            current_session_map.set(query.sessionId, sessionItem);
            res.send("add-ok");
        } else {
            res.status(400).send("miss-value");
        }
    }else{
        res.status(400).send("max-session-overflow");
    }

});


app.get("/delete-key", function (req, res) {
    let sessionId = req.query.sessionId;
    if (current_session_map.has(sessionId)) {
        process.kill(current_session_map.get(sessionId).childPid);
        current_session_map.delete(sessionId);
    }
    res.send("delete-ok");
});



app.get("/query-key",function(req,res) {
    let sessionId = req.query.sessionId;
    if(current_session_map.has(sessionId)){
        if (current_session_map.get(sessionId).goodsItem !== undefined) {
            res.send(current_session_map.get(sessionId).goodsItem);
            console.log("response query: ");
        } else {
            res.status(400).send('goods_item_undefined');
        }
    }
    else {
            res.status(400).send("invalid-sessionId");
    }
});


app.get("/get-key-list", function (req, res) {
    res.send(get_key_array());
});

app.listen(3000, function () {
    console.log("Server is listening at port 3000");
});




