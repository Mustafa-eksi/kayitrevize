const electron = require('electron');
const url = require("url");
const path = require("path");
const excel = require('exceljs');
const workbook = new excel.Workbook();
const {app, BrowserWindow, ipcMain} = electron;
const sql = require("sqlite3").verbose();
var qr = require('qr-image');
const fs = require('fs');
const db = new sql.Database("./database.db", sql.OPEN_READWRITE, (err) => {
    if(err) return console.error(err.message);
});

const ROLLER_DIZISI = [
    {name: "Yazılımcı", aynianda_secilebilir:true},
    {name: "Yardımcı", aynianda_secilebilir:true},
    {name: "Takım üyesi", aynianda_secilebilir:false},
    {name: "Araştırmacı", aynianda_secilebilir:false},
    {name: "Bireysel", aynianda_secilebilir:true, bireyselmi:true},
]

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

function rolKontrol(roller) { // roller: string ("1,2,3" gibi). Roller tutarlıysa true, çelişkiliyse false döndürür.
    let roll = roller.split(",");
    let aynandasecti = false;
    if(!roll.includes(ROLLER_DIZISI.findIndex(v => v.bireyselmi).toString())) {
        return false;
    }
    for(let i = 0; i < roll.length; i++) {
        if(!ROLLER_DIZISI[parseInt(roll[i])].aynianda_secilebilir && !aynandasecti) {
            aynandasecti = true;
        }else if(!ROLLER_DIZISI[parseInt(roll[i])].aynianda_secilebilir && aynandasecti) {
            return false;
        }
    }
    return true;
}

//bireysel rolünü otomatik kaydet
function kayit(tc, isimsoyisim, roller) {
    return new Promise((res,rej)=>{
        if(!tc || !isimsoyisim || isNaN(tc)) {
            rej("Girilen bilgiler hatalı")
            return;
        }
        if(!rolKontrol(roller)) {
            return rej("Roller hatalı: " + roller);
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
                        }else {
                            var qr_svg = qr.image(v, { type: 'png' });
                            qr_svg.pipe(require('fs').createWriteStream("./qrlar/"+isimsoyisim+'.png'));
                            res("Kullanici eklendi")
                        }
                    }
                );
            })
        })
    })
}
// rollerin doğruluğunu kontrol et yanlışsa reject
async function coklukayit(bilgiler) {
    for(let i = 0; i < bilgiler.length; i++) {
        await kayit(bilgiler[i].tc, bilgiler[i].isimsoyisim, bilgiler[i].roller).catch(err=>{
            if(err === "Bu tc veritabanında zaten kayıtlı")
                return;
            throw err;
        })
    }
    return "İşlem bitti."
}

function rollerdenIndekslere(roller) {
    let result = [];
    for(let i = 0; i < roller.length; i++) {
        let ind = ROLLER_DIZISI.findIndex(v=>v.name===roller[i]);
        if(ind !== -1) {
            result.push(ind);
        }
    }
    return result;
}

function UpdateUser(tc, yeniroller) {
    return new Promise((res,rej)=>{
        if(!rolKontrol(yeniroller)) {
            return rej("Roller yanlış: " + yeniroller)
        }
        db.all("select roller,sicil_no from users where tc_no=?", [tc], (err, rows)=>{
            if(err) {
                rej(err.message);
                return console.error(err.message);
            }
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

async function CokluRevize(bilgiler) { // bilgiler = [{sicilno:23, yenirol:"0,2,3"}]
    for(let i = 0; i < bilgiler.length; i++) {
        if(!rolKontrol(bilgiler[i].yenirol)) {
            throw new Error((i+2)+". satırda hatalı rol")
        }
        let user = await GetUserSicil(bilgiler[i].sicilno);
        let cikti = await UpdateUser(user.tc_no, bilgiler[i].yenirol);
        if(cikti !== "İşlem başarıyla gerçekleştirildi") {
            console.log(cikti);
        }
    }
}

function GetUser(tc) {
    return new Promise((res,rej)=>{
        db.all("select sicil_no, isim_soyisim, kartid, roller from users where tc_no=?", [tc], (err, rows)=>{
            if(err) {
                rej(err.message);
                return console.error(err);
            }
            if(!rows[0]) {
                rej("Kullanıcı bulunamadı");
                return;
            }
            res({
                isim_soyisim: rows[0]["isim_soyisim"],
                kartid: rows[0]["kartid"],
                roller: rows[0]["roller"],
                sicil_no:rows[0]["sicil_no"]
            })
        })
    })
}

function GetUserSicil(sicil) {
    return new Promise((res,rej)=>{
        db.all("select tc_no, isim_soyisim, kartid, roller from users where sicil_no=?", [sicil], (err, rows)=>{
            if(err) {
                rej(err.message);
                return console.error(err);
            }
            if(!rows[0]) {
                rej("Kullanıcı bulunamadı");
                return;
            }
            res({
                isim_soyisim: rows[0]["isim_soyisim"],
                kartid: rows[0]["kartid"],
                roller: rows[0]["roller"],
                tc_no:rows[0]["tc_no"]
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
    ipcMain.handle('coklu-kayit', async (e, path)=>{
            await workbook.xlsx.readFile(path);
            const worksheet = workbook.getWorksheet('Sheet1');
            let bilgiler = [];
            for(let i = 2; i <= worksheet.rowCount; i++) {
                const row = worksheet.getRow(i);
                if(!row.getCell('A').text || !row.getCell('B').value || !row.getCell('C').value) {
                    throw new Error("Dosya düzeninde hata! Dosya düzeni hakkında bilgi almak için 'Nasıl çalışır?' butonuna tıklayınız")
                }
                const tckn = parseInt(row.getCell('A').text);
                const isimsoyisim = row.getCell('B').value.toString();
                const roller = row.getCell('C').value.toString();
                if(isNaN(tckn)) {
                    break;
                }
                let rolind = rollerdenIndekslere(roller.split(',')).join(',');
                bilgiler.push({
                    tc: tckn,
                    isimsoyisim: isimsoyisim,
                    roller: rolind
                })
            }
            return await coklukayit(bilgiler);
    });
    ipcMain.handle('roller', (e)=>{return ROLLER_DIZISI});
    
    ipcMain.handle('get-user', async(e, tc)=>{
        return await GetUser(tc);
    })

    ipcMain.handle('get-user-sicil', async(e,sicil)=>{
        return await GetUserSicil(sicil);
    })

    ipcMain.handle('revize', (e, tc, yeniroller)=>{
        return UpdateUser(tc, yeniroller);
    });
    ipcMain.handle('coklu-revize', (e, path)=>{
        return new Promise((res,rej)=>{
            workbook.xlsx.readFile(path).then(()=>{
                const worksheet = workbook.getWorksheet('Sheet1');
                let bilgiler = [];
                for(let i = 2; i <= worksheet.rowCount; i++) {
                    const row = worksheet.getRow(i);
                    const hamsicil = row.getCell('A').text;
                    const sicilno = parseInt(hamsicil.substring(1,hamsicil.length)); // NOT: sicilno'nun başına T gelmiyecek.
                    if(isNaN(sicilno))
                        return rej("Hatalı sicilno, satır: " + i)

                    if(!row.getCell('B').value)
                        return rej("Rol kısmı boş bırakılamaz, satır: " + i)

                    const yenirol = row.getCell('B').value.toString();
                    let rolind = rollerdenIndekslere(yenirol.split(',')).join(',');
                    bilgiler.push({
                        sicilno: sicilno,
                        yenirol: rolind,
                    })
                }
                CokluRevize(bilgiler).then((v)=>{
                    res(v);
                }).catch((err)=>{ if(err) rej(err) })
            }).catch((err)=>{ if(err) rej(err) });
        })
    });
})