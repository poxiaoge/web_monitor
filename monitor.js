/**
 * Created by poxiaoge on 2017/1/17.
 */
const cheerio = require("cheerio");
var superagent = require("superagent");
const fs = require("fs");
const encoding = require('encoding');
const superagent_charset = require("superagent-charset");
const child_process = require("child_process");
superagent = superagent_charset(superagent);


var new_goods = new GoodsItem();
var old_goods_string = "";
function GoodsItem(title,link,price,desc,seller) {
    this.title = title;
    this.link = link;
    this.price = price;
    this.desc = desc;
    this.seller = seller;
}


//https://s.2.taobao.com/list/list.htm?spm=2007.1000337.6.2.HQdTi0&st_edtime=1&start=1500&end=3000&q=%CB%F7%C4%E1ps4&ist=0

function xianyuMonitor(input) {

    let goods = input[0];
    let startPrice = input[1];
    let endPrice = input[2];

    console.log("key: " + goods);
    let query_url = createXianyuUrl(startPrice, endPrice, goods);
    superagent.get(query_url).charset("gbk").end(function (err, res) {
        if (err) {
            console.log("Err in superagent:" + err);
        }
        else {
            let $ = cheerio.load(res.text);
            if ($("ul.item-lists").length > 0) {
                let $item_info = $("ul.item-lists").find("li.item-info-wrapper").eq(0);
                let $item_title = $item_info.find("h4.item-title").eq(0).find("a").eq(0);
                let item_title = $item_title.text();
                let item_link ="https:" + $item_title.attr("href");
                let item_price = $item_info.find("span.price").eq(0).find("em").eq(0).text();
                let item_desc = $item_info.find("div.item-description").eq(0).text();
                let item_seller = $item_info.find("span.J_WangWang").eq(0).attr("data-nick");
                new_goods.title = item_title;
                new_goods.link = item_link;
                new_goods.price = item_price;
                new_goods.desc = item_desc;
                new_goods.seller =  item_seller;
                let new_goods_string = JSON.stringify(new_goods);
                if (new_goods_string !== old_goods_string) {
                    let ignoreArr = ["收", "求"];
                    if (verifyTitle(item_title,goods,ignoreArr)) {
                        old_goods_string = new_goods_string;
                        process.send(new_goods);
                        console.log(new_goods_string);
                    }
                }
            }
        }
    });
}

function createXianyuUrl(startPrice, endPrice, q) {
    let q_gbk = utf8ToGbk(q);
    let url = "https://s.2.taobao.com/list/list.htm?spm=2007.1000337.6.2.HQdTi0&st_edtime=1&start=" + startPrice + "&end=" + endPrice + "&q="
        + q_gbk + "&ist=0";
    return url;
}


function utf8ToGbk(s) {
    let s_hex = encoding.convert(s, "gb2312").toString("hex");
    let s_gbk = "";
    for (let i = 0; i < s_hex.length; i += 2) {
        s_gbk += "%" + s_hex.substring(i, i + 2);
    }
    return s_gbk;
}


function runMonitor() {
    console.log("child " + process.pid + " : runMonitor");
    console.log("process.argv: " + process.argv);
    let monitorInterval = Number(process.argv[2]);
    let goods =decodeURI(process.argv[3]);
    let startPrice = process.argv[4];
    let endPrice = process.argv[5];
    setImmediate(xianyuMonitor, [goods, startPrice, endPrice]);
    setInterval(xianyuMonitor, monitorInterval,[goods, startPrice, endPrice]);
}
// setInterval(xianyuMonitor, 20000);


function testChild() {
    console.log("number " + process.argv[2] + ": " + "msg in testChild " + process.pid);
    process.send(process.pid);
    setInterval(function (abc) {
        console.log("child " + process.pid + " is online " + abc);
    }, 2000, ["abc"]);
}

// module.exports = testChild;

// testChild();

process.on("exit", function (exitCode) {
    console.log("child " + process.pid + " has been closed");
});


process.on("message", function (m) {
    if (m === "child_exit") {
        process.exit();
    }
    else {
        console.log("child " + process.pid + " get a message:" + m);
    }
});

runMonitor();

function verifyTitle(title,key,ignoreArray) {
    //Array[1]为关联或非左边的部分
    let re1 = /(.+)(关联|非|换)(.+)/;

//筛选出双字节字符
// var re2 = /([^x00-xff]+)/;
    let re2 = /[\u4e00-\u9fa5]/;
//筛选英文
    let re3 = /([a-zA-Z0-9\-_~!@&\(\))]+)/;


    if(title==="" || key === ""){
        return false;
    }

    // console.log("title is :" + title);

    // if(ignoreStr!=="" && title.toLowerCase().indexOf(ignoreStr.toLowerCase())!==-1) {
    //     return false;
    // }
    let flag = false;
    if(ignoreArray.length > 0) {
        ignoreArray.forEach(function (value) {
            if(value!=="" && title.toLowerCase().indexOf(value.toLowerCase())!==-1) {
                console.log(value+": false");
                flag = true;
            }
        });
    }

    if(flag){
        return false;
    }


    if(title.indexOf("关联") === -1 && title.indexOf("非") === -1  && title.indexOf("换") === -1) {
        return true;
    }


    let realTitle = re1.exec(title)[1];
    let bitKeyEng = 0;
    let bitKeyCn  =0;
    let bitTitleEng = 0;
    let bitTitleCn=0;

    if(key.search(re3) !== -1) {
        bitKeyEng = 1;
    }
    if(realTitle.search(re3) !== -1) {
        bitTitleEng = 1;
    }
    if(key.search(re2) !== -1) {
        bitKeyCn = 1;
    }
    if(realTitle.search(re2) !== -1) {
        bitTitleCn = 1;
    }

    let patternKey = (bitKeyCn<<1) | bitKeyEng;
    let patternTitle = (bitTitleCn << 1) | bitTitleEng;
    let patternAll = patternTitle << 2 | patternKey;
    //    titleCN, titleEng, keyCn, keyEng
    //0101:     search key in title
    //1010:     search key in title
    //0111:     find eng in key , search key in title
    //1101:     find eng in title, search key in title
    //1011:     find cn in key, search key in title
    //1110:     find cn in title, search key in title
    //1111:     find eng in key ,find eng in title, search key in title

    let arrayValid = [0b0101, 0b0111, 0b1010, 0b1011, 0b1101, 0b1110, 0b1111];
    if(arrayValid.indexOf(patternAll) === -1) {
        return false;
    }


    let finalKey="";
    let finalTitle="";

    switch (patternAll) {
        case 0b0101:
        case 0b1010:
            finalKey = key;
            finalTitle = realTitle;
            break;
        case 0b0111:
            finalKey = re3.exec(key)[1];
            finalTitle = realTitle;
            break;
        case 0b1101:
            finalTitle = re3.exec(realTitle)[1];
            finalKey = key;
            break;
        case 1011:
            finalKey = re2.exec(key)[1];
            finalTitle = realTitle;
            break;
        case 1110:
            finalTitle = re2.exec(realTitle)[1];
            finalKey = key;
            break;
        case 0b1111:
            finalKey = re3.exec(key)[1];
            finalTitle = re3.exec(realTitle)[1];
            break;
    }

    if(finalTitle.toLowerCase().indexOf(finalKey.toLowerCase()) !== -1) {
        return true;
    }
    else {
        return false;
    }

}


function testUTF() {
    let pre = encodeURI("索尼ps4");
    let send = decodeURI(pre);
    console.log(send);
    console.log(utf8ToGbk(send));
}
// testUTF();