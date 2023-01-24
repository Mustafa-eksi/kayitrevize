const {ipcRenderer} = require('electron');
const finput = document.querySelector("#formFile");
const check_model = document.querySelector("#model");
const tekli = document.querySelector("#tekli");
const rolliste = document.querySelector("#ekran2 > #rolliste");
const kaydet = document.querySelector("#kaydet");
const coklukaydet = document.querySelector("#coklukaydet");
const kartidrev = document.querySelector("#kartidrev");
const tcnorev = document.querySelector("#tcnorev");
const isimsoy = document.querySelector("#isimrev");
const revizebuton = document.querySelector("#update");
const sicilrev = document.querySelector("#sicilrev");
const rollistesor = document.querySelector("#rollistesor");
const selectrol1 = document.querySelector("#dropdown1")
const selectrol2 = document.querySelector("#dropdown2")
const selectrol3 = document.querySelector("#dropdown3")
const selectreset = selectrol1.innerHTML;
const tabbuttons =  [ document.querySelector("#tab1"), document.querySelector("#tab2"), document.querySelector("#tab3") ];
let roller_dizisi = [];
let currentTab = 1;

function rollisteOlustur(rollist, selectable, roller) {
    rollist.innerHTML = "";
    selectable.innerHTML = selectreset
    //Bireysel butonu en üstte olsun diye
    let bry = check_model.cloneNode(true);
    bry.querySelector(":scope > #flexCheckDefault").disabled = true;
    bry.querySelector(":scope > #flexCheckDefault").checked = true;
    bry.className = "form-check";
    bry.querySelector(":scope > #labol").textContent = roller.find(v=>v.bireyselmi===true).name;
    rollist.appendChild(bry);
    rollist.children[0].id = "a"+roller.findIndex(v => v.bireyselmi).toString()
    let ci = 1;
    for(let i = 0; i < roller.length; i++) {
        if(roller[i].aynianda_secilebilir === false) {
            let ayn = document.createElement("option");
            ayn.innerText = roller[i].name;
            ayn.value = i;
            console.log(ayn)
            //ayn.innerHTML = `<option value="${i}">${roller[i].name}</option>`;
            selectable.appendChild(ayn);
        }else {
            let a = check_model.cloneNode(true);
            if(roller[i].bireyselmi === true) { // bireyselse geç
                continue;
            }
            a.className = "form-check";
            a.querySelector(":scope > #labol").textContent = roller[i].name;
            rollist.appendChild(a);
            rollist.children[ci].id = "a"+i.toString()
            ci++
        }
    }
}

function RollereBak(checkdiv, selectable) {
    let roller = [];
    for(let i = 0; i < checkdiv.childElementCount; i++) {
        if(checkdiv.children[i].querySelector(":scope > #flexCheckDefault").checked) {
            let name = checkdiv.children[i].querySelector(":scope > #labol").textContent;
            let index = roller_dizisi.findIndex(v => v.name===name)
            roller.push(index)
        }
    }
    if(selectable.selectedIndex != 0) {
        roller.push(roller_dizisi.findIndex(v => v === roller_dizisi.filter(b=>!b.aynianda_secilebilir)[selectable.selectedIndex-1]));
    }
    return roller;
}

function rollisteDoldur(rollistearg, selectable, rollerimiz) {
    for(let i = 0; i < rollistearg.children.length; i++) {
        rollistearg.children[i].querySelector(":scope > #flexCheckDefault").checked = false;
    }
    for(let i = 0; i < rollerimiz.length; i++) {
        let r = roller_dizisi[parseInt(rollerimiz[i])];
        if(r.aynianda_secilebilir === true) {
            let chckbx = rollistearg.querySelector(":scope > #a"+parseInt(rollerimiz[i]).toString());
            console.log(rollerimiz, i, ":scope > #a"+parseInt(rollerimiz[i]).toString(), chckbx, r)
            chckbx.querySelector(":scope > #flexCheckDefault").checked = true;
        }else {
            selectable.selectedIndex = roller_dizisi.filter(v => !v.aynianda_secilebilir).findIndex(v => v.name === roller_dizisi[parseInt(rollerimiz[i])].name)+1;
        }
    }
}

document.querySelectorAll('[data-bs-toggle="popover"]')
    .forEach(popover => {
        new bootstrap.Popover(popover)
    })

// Bu alert metodunu https://getbootstrap.com/docs/5.3/components/alerts/#examples'den aldım ama biraz değiştirdim
const alertPlaceholder = document.getElementById('liveAlertPlaceholder')
const alertb = (message, type) => {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = [
        `<div class="alert alert-${type} alert-dismissible" role="alert">`,
        `   <div>${message}</div>`,
        `   <button type="button" onclick="this.parentElement.classList.add('invisible')" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>`,
        '</div>'
    ].join('')

    alertPlaceholder.append(wrapper)
}
//

for(let i = 0; i < tabbuttons.length; i++) {
    tabbuttons[i].addEventListener('click', ()=>{
        if(i == 1) {
            rollisteOlustur(rolliste, selectrol2, roller_dizisi)
        }else if(i === 2) {
            rollisteOlustur(rollistesor, selectrol3, roller_dizisi)
        }
        let fromtab = document.querySelector("#ekran"+currentTab);
        fromtab.classList.add("invisible");
        document.querySelector("#ekran"+(i+1)).classList.remove("invisible");
        tabbuttons[currentTab-1].querySelector(":scope > a").classList.remove("active");
        tabbuttons[i].querySelector(":scope > a").classList.add("active");
        currentTab = i+1;
    })
}
ipcRenderer.invoke('roller').then((v)=>{
    roller_dizisi = v;
    rollisteOlustur(tekli,selectrol1, roller_dizisi)
})

kaydet.addEventListener('click',()=>{
    let isimsoyi = document.querySelector("#isim_soyisim").value;
    let tckno = document.querySelector("#tcno").value;
    let roller = RollereBak(tekli, selectrol1);
    ipcRenderer.invoke('kayit', {
        tc: parseInt(tckno),
        isimsoyisim:isimsoyi,
        roller:roller.join(',')
    }).then((v)=>{
        alertb(v, 'success');
    }).catch((err)=>{
        if(err) {
            alertb(err, 'danger')
            console.error(err);
        }
    })
})

coklukaydet.addEventListener('click',()=>{
    if(!finput.files[0]) {
        alertb("Çoklu kayıt için dosya seçiniz", "danger")
    }
    let val = finput.files[0].path;
    ipcRenderer.invoke('coklu-kayit', val).then((v)=>{
        alertb("İşlem başarıyla tamamlandı!", 'success')
    }).catch((err)=>{
        if(err) {
            alertb("HATA: " + err, 'danger')
            console.error(err);
        }
    })
})

tcnorev.addEventListener("change", ()=>{
    let val = tcnorev.value;
    ipcRenderer.invoke('get-user', parseInt(val)).then((v)=>{
        if(!v) {
            alertb("Girilen bilgiler hatalı.", "danger")
            return;
        }
        isimsoy.value = v.isim_soyisim;
        sicilrev.value = v.sicil_no;
        kartidrev.value = v.kartid;
        let rollerimiz = v.roller.split(',');
        rollisteDoldur(rolliste, selectrol2, rollerimiz);
    }).catch((err)=>{
        if(err) {
            alertb("kullanıcı bulunamadı", "danger")
            console.info(err);
        }
    })
})
revizebuton.addEventListener('click', ()=>{
    if(!tcnorev.value || isNaN(parseInt(tcnorev.value))) {
        alertb("Girilen bilgiler hatalı veya eksik", 'danger')
        return;
    }
    let roller = RollereBak(rolliste, selectrol2);
    ipcRenderer.invoke('revize', parseInt(tcnorev.value), roller.join(',')).then((v)=>{
        alertb(v, 'success');
    }).catch((err)=>{
        if(err) {
            alertb(err, 'danger');
            console.error(err);
        }
    })
})



sicilrev.addEventListener('change', async()=>{
    let val = sicilrev.value;
    let v = await ipcRenderer.invoke('get-user-sicil', parseInt(val)).catch((err)=>{
        if(err) {
            alertb("kullanıcı bulunamadı", "danger")
            console.info(err);
        }
    });
    if(!v) {
        alertb("Girilen bilgiler hatalı.", "danger")
        return;
    }
    isimsoy.value = v.isim_soyisim;
    kartidrev.value = v.kartid;
    tcnorev.value = v.tc_no
    let rollerimiz = v.roller.split(',');
    rollisteDoldur(rolliste,selectrol2, rollerimiz);
})

// EKRAN 3
const tcsor = document.querySelector("#tcnosor");
const sicilsor = document.querySelector("#sicilsor");
const isimsor = document.querySelector("#isimsor");
const kartidsor = document.querySelector("#kartidsor")
tcsor.addEventListener('change', ()=>{
    let val = tcsor.value;
    ipcRenderer.invoke('get-user', parseInt(val)).then((v)=>{
        if(!v) {
            alertb("Girilen bilgiler hatalı.", "danger")
            return;
        }
        isimsor.value = v.isim_soyisim;
        kartidsor.value = v.kartid;
        sicilsor.value = v.sicil_no;
        let rollerimiz = v.roller.split(',');
        rollisteDoldur(rollistesor,selectrol3, rollerimiz)
    }).catch((err)=>{
        if(err) {
            alertb("kullanıcı bulunamadı", "danger")
            console.info(err);
        }
    })
})
sicilsor.addEventListener('change', async ()=>{
    let val = sicilsor.value;
    let kullanici = await ipcRenderer.invoke('get-user-sicil', parseInt(val)).catch((err)=>{if(err) {
            alertb("kullanıcı bulunamadı", "danger")
            console.info(err);
        }});
    if(!kullanici) return;
    isimsor.value = kullanici.isim_soyisim;
    kartidsor.value = kullanici.kartid;
    tcsor.value = kullanici.tc_no;
    let rollerimiz = kullanici.roller.split(',');
    rollisteDoldur(rollistesor,selectrol3, rollerimiz)
})