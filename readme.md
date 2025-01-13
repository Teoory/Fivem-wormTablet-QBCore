core içinde jobs değiştirildi -> hacker işi eklendi tablet bu işe sahip olan kullanıcılar tarafından erişilebilir.
<br/>
/setjob id hacker job-rank
<br/>

	hacker = {
		label = 'Hacker',
		defaultDuty = true,
		offDutyPay = false,
		grades = {
			['0'] = { name = 'Script', payment = 50 },
			['1'] = { name = 'Hacker', payment = 75 },
			['2'] = { name = 'Elite', payment = 100 },
			['3'] = { name = 'Master', payment = 125 },
			['4'] = { name = 'Chief', isboss = true, payment = 150000 },
		},
	},



core içinde items eklendi -> hackerlar için worm tablet
<br/>
/giveitem 1 worm-tablet 1
<br/>

    ['worm-tablet']              = { name = 'worm-tablet', label = 'WormOS Tablet', weight = 2000, type = 'item', image = 'tablet.png', unique = true, useable = true, shouldClose = true, combinable = nil, description = 'Gelişmiş bir hacking tableti' },


<br/>
+güvenlik duvarı eklenecek <br/>
+taskbar saat ve <br/>
+taskbar güvenlik duvarı ayarları eklenecek <br/>
+güvenlik duvarı açık olan tabletlerin locate ile konumu bulunamayacak! <br/>
+güvenlik duvarı açıksa terminal kullanılamaz <br/>
+chat uygulaması fixlenecek, yeni mesajlar en altta gözükmeli <br/>
+mail sistemi kullanıcı bazlı mesaj silme işlevi <br/>
+mail okundu bilgisi db kaydedilecek <br/>
+mail sistemine görsel paylaşımı, renkli yazılar vb. gelişmişi özellikler eklenecek. <br/>
+login ve register için ağ bağlantısı <br/>
+taskbar ağ bağlantısı eklenecek. <br/>
+tor browser eklenecek <br/>
+dark web eklenecek <br/>
+terminale exec doody-shop yazdığım zaman bir uygulama açılmalı, bu uygulamada envanterimdeki eşyalar arasından seçim yapabilmeliyim, eşya seçiminden sonra ücreti belirleyerek kaydete tıklarsam özel bir link oluşturulacak. tor browser da ana ekranda linkler gözükecek, gözüken linki tor browsardaki link alanına girince item sayfası açılacak, bu sayede alışveriş yapılabilecek. <br/>
+dark web store sayfası olacak <br/>
+geniş çaplı özel haritada özel konum paylaşma eklenecek saat bilgisi ile birlikte <br/>
+özel sohbet kanallı eklenecek <br/>

terminal v2 eklenecek <br/>
sadece üst seviye hackerlar güvenlik duvarını geçebilecek <br/>

-sinyal kalitesi eklenecek <br/>

anonim tweet gönderme <br/>
tweet beğeni arttırma <br/>
güvenlik kamerası hack  <br/>
