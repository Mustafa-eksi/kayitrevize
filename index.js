const electron = require('electron');
const url = require("url");
const path = require("path");
const {app, BrowserWindow, ipcMain} = electron;
const sql = require("sqlite3").verbose();
const db = new sql.Database("./database.db", sql.OPEN_READWRITE, (err) => {
    if(err) return console.error(err.message);
});

function kartidOlustur() {
    var kartid = "1";
    for(var k = 1; k <= 1; k++) {
        var sayi = Math.floor(Math.random() * 10).toString();
        kartid += sayi;
    }
    return kartid;
}

function kartidkontrol(kartid) {
    return new Promise((res, rej)=>{
        db.all("SELECT count(*) FROM users where kartid=?", [kartid], (err, kartidliler)=>{
            if(err) {
                rej(err.message);
            }
            if(kartidliler[0]['count(*)'] == 0) {
                res(kartid);
            }else {
                kartidkontrol(kartidOlustur()).then((v)=>{
                    res(v);
                }).catch((e)=>{
                    if(err) {
                        rej(err)
                    }
                })
            }
        })
    })
}

function kayit(tc, isimsoyisim, roller) {
    return new Promise((res,rej)=>{
        if(!tc || !isimsoyisim || !roller || isNaN(tc)) {
            rej("Girilen bilgiler hatalı")
            return;
        }
        db.all("select count(*) from users where tc_no=?", [tc], (err, rows1)=>{
            if(err) {
                rej(err.message);
                return;
            }
            if(rows1[0]["count(*)"] != 0) {
                rej("Bu tc veritabanında zaten kayıtlı");
                return;
            }
            kartidkontrol(kartidOlustur()).then((v)=>{
                db.run("insert into users (tc_no,isim_soyisim,yil,kartid,roller,kayit_ts) values (?,?,?,?,?,?)", [tc, isimsoyisim, new Date(Date.now()).getFullYear(), v, roller, new Date(Date.now()).toLocaleString()], 
                    (err)=>{
                        if(err) {
                            rej(err.message);
                            return;
                        }
                    }
                );
                res("Kullanici eklendi")
            })
        })
    })
}

app.on('ready', ()=>{
    mainWindow = new BrowserWindow({
        webPreferences: {
            nodeIntegration:true,
            contextIsolation:false,
            enableRemoteModule:true
        }
    });
    mainWindow.loadURL(
        url.format({
            pathname:path.join(__dirname, "index.html"),
            protocol:"file:",
            slashes:true
    }));
    ipcMain.handle('kayit', (e, arg)=> { // arg = {tc, isimsoyisim, roller}
        return new Promise((res, rej)=>{
            kayit(arg.tc, arg.isimsoyisim, arg.roller).then((v)=>{
                res(v);
            }).catch((err)=>{
                if(err) {
                    rej(err)
                }
            })
        })
    });
})