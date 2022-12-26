const electron = require('electron');
const url = require("url");
const path = require("path");
const excel = require('exceljs');
const workbook = new excel.Workbook();
const {app, BrowserWindow, ipcMain} = electron;
const sql = require("sqlite3").verbose();
const db = new sql.Database("./database.db", sql.OPEN_READWRITE, (err) => {
    if(err) return console.error(err.message);
});

const ROLLER_DIZISI = ["Yazılımcı", "Yardımcı", "Takım üyesi", "Araştırmacı"]; // veritabanına kaydederken rolün bu dizideki sırası kullanılacak. Mesela "Yazılımcı" için 0, "Takım üyesi" için 2 gibi.

function kartidOlustur() {
    var kartid = "42";
    for(var k = 1; k <= 5; k++) {
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
        if(!tc || !isimsoyisim || isNaN(tc)) {
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

function coklukayit(bilgiler) {
    return new Promise((res,rej)=>{
        if(bilgiler.length === 0) {
            res("İşlem bitti.");
        }else {
            kayit(bilgiler[0].tc, bilgiler[0].isimsoyisim, bilgiler[0].roller).then((v)=>{
                let yeni = bilgiler;
                yeni.shift();
                coklukayit(yeni).then((v)=>{
                    res(v);
                }).catch((err)=>{
                    if(err) {
                        rej(err)
                    }
                })
            }).catch((err)=>{
                if(err) {
                    rej(err)
                }
            })
        }
    })
}

function rollerdenIndekslere(roller) {
    let result = [];
    for(let i = 0; i < roller.length; i++) {
        let ind = ROLLER_DIZISI.indexOf(roller[i]);
        if(ind !== -1) {
            result.push(ind);
        }
    }
    return result;
}

function UpdateUser(tc, yeniroller) {
    return new Promise((res,rej)=>{
        db.all("select roller,sicilno from users where tc_no=?", [tc], (err, rows)=>{
            let eskiroller = rows[0]["roller"];
            let sicilno = rows[0]["sicil_no"];
            db.run("update users set roller=? where tc_no=?", [yeniroller, tc], (err)=>{
                if(err) {
                    rej(err.message);
                }else {
                    db.run("insert into revize (sicil_no,onceki_roller,sonraki_roller,ts) values (?,?,?,?)", [sicilno, eskiroller, yeniroller, new Date(Date.now()).toLocaleString()], (err)=>{
                        if(err) {
                            rej(err.message);
                        }else {
                            res("İşlem başarıyla gerçekleştirildi")
                        }
                    })
                }
            })
        })
    })
}

function GetUser(tc) {
    return new Promise((res,rej)=>{
        db.all("select isim_soyisim, kartid, roller from users where tc_no=?", [tc], (err, rows)=>{
            if(err) {
                rej(err.message);
                return console.error(err);
            }
            res({
                isim_soyisim: rows[0]["isim_soyisim"],
                kartid: rows[0]["kartid"],
                roller: rows[0]["roller"]
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
    ipcMain.handle('coklu-kayit', (e, path)=>{
        return new Promise((res,rej)=>{
            workbook.xlsx.readFile(path).then(()=>{
                const worksheet = workbook.getWorksheet('Sheet1');
                let bilgiler = [];
                for(let i = 2; i <= worksheet.rowCount; i++) {
                    const row = worksheet.getRow(i);
                    const tckn = parseInt(row.getCell('A').text);
                    if(isNaN(tckn)) {
                        break;
                    }
                    const isimsoyisim = row.getCell('B').value.toString();
                    const roller = row.getCell('C').value.toString();
                    let rolind = rollerdenIndekslere(roller.split(',')).join(',');
                    bilgiler.push({
                        tc: tckn,
                        isimsoyisim: isimsoyisim,
                        roller: rolind
                    })
                }
                coklukayit(bilgiler).then((v)=>{
                    res(v);
                }).catch((err)=>{ if(err) rej(err) })
            }).catch((err)=>{ if(err) rej(err) });
        })
    });
    ipcMain.handle('roller', (e)=>{return ROLLER_DIZISI});
    
    ipcMain.handle('get-user', (e, tc)=>{
        return new Promise((res,rej)=>{
            GetUser(tc).then((v)=>{res(v)}).catch((err)=>{if(err) rej(err)})
        })
    })
})