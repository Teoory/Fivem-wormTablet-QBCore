$(document).ready(function() {
    let activeWindows = [];
    let currentUserInfo = null;
    let activeUsers = {};
    let commandHistory = [];
    let historyIndex = -1;
    let isLoggedIn = false;
    let currentUsername = null;
    let mailEditor = null;
    let firewallActive = false;
    let isConnectedToNetwork = false;
    let currentNetwork = null;

    // Terminal komutları
    const commands = {
        'help': {
            description: 'Mevcut komutların listesini gösterir',
            execute: () => {
                let output = 'Mevcut Komutlar:\n\n';
                for (const [cmd, info] of Object.entries(commands)) {
                    output += `${cmd} -> ${info.description}\n`;
                }
                return output;
            }
        },
        'clear': {
            description: 'Terminal ekranını temizler',
            execute: () => {
                $('#terminal-output').html('WormOS v1.0.0<br>');
                return '';
            }
        },
        'whoami': {
            description: 'Mevcut kullanıcıyı gösterir',
            execute: () => {
                if (currentUserInfo) {
                    return `IP Adresiniz: ${currentUserInfo.ip}`;
                }
                return 'IP bilgisi bulunamadı.';
            }
        },
        'netscan': {
            description: 'Ağdaki aktif kullanıcıları ve IP adreslerini gösterir',
            execute: () => {
                if (!activeUsers || Object.keys(activeUsers).length === 0) {
                    return 'Ağda aktif kullanıcı bulunamadı.';
                }

                let output = 'Ağdaki Aktif Kullanıcılar:\n\n';
                output += 'IP Adresi\t\t\n';
                output += '------------------------------------------------\n';
                
                Object.values(activeUsers).forEach(user => {
                    if (user && user.ip) {
                        output += `${user.ip}\n`;
                    }
                });
                
                return output || 'Ağda aktif kullanıcı bulunamadı.';
            }
        },
        'locate': {
            description: 'Belirtilen IP adresinin konumunu haritada işaretler (Örnek: locate 34.62.75.37)',
            execute: (args) => {
                if (!args || args.length === 0) {
                    return 'Kullanım: locate ip_adresi';
                }

                const ip = args[0];
                // IP formatını kontrol et (xx.xx.xx.xx)
                const ipRegex = /^\d{2}\.\d{2}\.\d{2}\.\d{2}$/;
                if (!ipRegex.test(ip)) {
                    return 'Geçersiz IP format. Örnek: 34.62.75.37';
                }

                $.post(`https://${GetParentResourceName()}/locatePlayer`, JSON.stringify({
                    ip: ip
                }));

                return 'IP adresi aranıyor...';
            }
        },
        'exit': {
            description: 'Terminal penceresini kapatır',
            execute: () => {
                $('#terminal-window').hide();
                return '';
            }
        },
        'exec': {
            description: 'Belirtilen uygulamayı çalıştırır',
            execute: (args) => {
                if (!args || args.length === 0) {
                    return 'Kullanım: exec uygulama-adı';
                }

                const app = args[0].toLowerCase();
                if (app === 'doody-shop') {
                    if (!isLoggedIn) {
                        showNotification('error', 'Doody Shop kullanımı için giriş yapmalısınız!');
                        return 'Erişim reddedildi: Giriş gerekli';
                    }
                    $('#doody-shop-window').show().css({
                        'top': '50px',
                        'left': '50px'
                    });
                    loadInventoryItems();
                    return 'Doody Shop uygulaması açılıyor...';
                } else if (app === 'city-db') {
                    openCityDB();
                    return 'City Database açılıyor...';
                }

                return 'Uygulama bulunamadı: ' + app;
            }
        },
        'register': {
            description: 'Yeni kullanıcı kaydı oluştur',
            execute: () => {
                $('#register-window').show().css({
                    'top': '70px',
                    'left': '70px'
                });
                $('#register-username').focus();
                return 'Kayıt ekranı açılıyor...';
            }
        },
        'login': {
            description: 'Kullanıcı girişi yap',
            execute: () => {
                $('#login-window').show().css({
                    'top': '70px',
                    'left': '70px'
                });
                $('#login-username').focus();
                return 'Giriş ekranı açılıyor...';
            }
        },
        'nchat': {
            description: 'Yeni bir NChat odası oluşturur',
            execute: () => {
                if (!isLoggedIn) {
                    showNotification('error', 'NChat kullanımı için giriş yapmalısınız!');
                    return 'Erişim reddedildi: Giriş gerekli';
                }
                
                // Rastgele oda kodu oluştur (örn: NC-XXXX)
                const roomCode = 'NC-' + Math.random().toString(36).substr(2, 4).toUpperCase();
                
                $('#nchat-window').show().css({
                    'top': '50px',
                    'left': '50px'
                });
                
                // Odaya bağlan
                connectToRoom(roomCode);
                return `NChat odası oluşturuluyor... Oda kodu: ${roomCode}`;
            }
        },
        'connect': {
            description: 'Var olan bir NChat odasına bağlanır (Örnek: connect NC-XXXX)',
            execute: (args) => {
                if (!isLoggedIn) {
                    showNotification('error', 'NChat kullanımı için giriş yapmalısınız!');
                    return 'Erişim reddedildi: Giriş gerekli';
                }
                
                if (!args || args.length === 0) {
                    return 'Kullanım: connect oda-kodu';
                }

                const roomCode = args[0].toUpperCase();
                if (!roomCode.match(/^NC-[A-Z0-9]{4}$/)) {
                    return 'Geçersiz oda kodu formatı. Örnek: NC-XXXX';
                }

                $('#nchat-window').show().css({
                    'top': '50px',
                    'left': '50px'
                });
                
                // Odaya bağlan
                connectToRoom(roomCode);
                return `NChat odasına bağlanılıyor... Oda kodu: ${roomCode}`;
            }
        }
    };

    // Terminal giriş işleme
    function processCommand(command) {
        const [cmd, ...args] = command.trim().split(' ');
        
        commandHistory.push(command);
        historyIndex = commandHistory.length;

        let output = '';
        if (commands[cmd]) {
            output = commands[cmd].execute(args);
            if (cmd === 'clear') {
                $('#terminal-output').html('WormOS v1.0.0<br>');
                return;
            }
        } else {
            output = `Komut bulunamadı: ${cmd}\nKomutları görmek için 'help' yazın.`;
        }

        const terminalOutput = $('#terminal-output');
        terminalOutput.append(`\nroot@worm:~$ ${command}\n${output}\n\n`);
        
        // Otomatik scroll
        const terminal = $('.terminal-output-wrapper');
        terminal.scrollTop(terminal[0].scrollHeight);
    }

    // NUI Mesajları
    window.addEventListener('message', function(event) {
        const data = event.data;
        
        switch(data.action) {
            case "openTablet":
                $('.container').fadeIn();
                break;
            case "updateUserInfo":
                currentUserInfo = data.info;
                break;
            case "updateActiveUsers":
                activeUsers = data.users;
                break;
            case "locateSuccess":
            case "locateError":
            case "locateTimeout":
            case "locateWarning":
                appendTerminalOutput(data.message);
                break;
            case "registerResponse":
                $('#register-submit').prop('disabled', false).text('Kayıt Ol');
                if (data.data.success) {
                    // Başarılı kayıt bildirimi
                    const notification = `
                        <div class="notification success">
                            <i class="fas fa-check-circle"></i>
                            Kayıt başarılı! Giriş yapabilirsiniz.
                        </div>
                    `;
                    $('body').append(notification);
                    
                    // 3 saniye sonra bildirimi kaldır
                    setTimeout(() => {
                        $('.notification').fadeOut(500, function() {
                            $(this).remove();
                        });
                    }, 3000);
                    
                    // Register penceresini kapat, login penceresini aç
                    $('#register-window').hide();
                    $('#register-username, #register-password, #register-password-confirm').val('');
                    
                    setTimeout(() => {
                        $('#login-window').show().css({
                            'top': '70px',
                            'left': '70px'
                        });
                        $('#login-username').focus();
                    }, 500);
                } else {
                    $('#register-error').text(data.data.error);
                }
                break;
            
            case "loginResponse":
                $('#login-submit').prop('disabled', false).text('Giriş Yap');
                if (data.data.success) {
                    isLoggedIn = true;
                    $('#login-window').hide();
                    $('#login-username, #login-password').val('');
                    
                    // Başarılı giriş bildirimi
                    const notification = `
                        <div class="notification success">
                            <i class="fas fa-check-circle"></i>
                            Giriş başarılı! Hoş geldiniz, ${data.data.username}
                        </div>
                    `;
                    $('body').append(notification);
                    
                    setTimeout(() => {
                        $('.notification').fadeOut(500, function() {
                            $(this).remove();
                        });
                    }, 3000);
                } else {
                    $('#login-error').text(data.data.error);
                }
                break;
        }
    });

    // Yardımcı fonksiyon olarak scroll işlemini ekleyelim
    function scrollToBottom() {
        const terminal = $('.terminal-output-wrapper');
        terminal.scrollTop(terminal[0].scrollHeight);
    }

    // Terminal çıktısı eklemek için kullanılan tüm fonksiyonlarda bu yardımcı fonksiyonu kullanalım
    function appendToTerminal(message) {
        const terminalOutput = $('#terminal-output');
        terminalOutput.append(message);
        scrollToBottom();
    }

    // Tablet kapatma
    $('.start-menu').click(function() {
        $('.container').fadeOut();
        $.post(`https://${GetParentResourceName()}/closeTablet`, JSON.stringify({}));
    });

    // Terminal input olayları
    $('#terminal-input').on('keydown', function(e) {
        switch(e.which) {
            case 13: // Enter
                const command = $(this).val().trim();
                if (command !== '') {
                    processCommand(command);
                    $(this).val(''); // Input alanını temizle
                }
                break;
            case 38: // Up arrow
                if (historyIndex > 0) {
                    historyIndex--;
                    $(this).val(commandHistory[historyIndex]);
                }
                break;
            case 40: // Down arrow
                if (historyIndex < commandHistory.length - 1) {
                    historyIndex++;
                    $(this).val(commandHistory[historyIndex]);
                } else {
                    historyIndex = commandHistory.length;
                    $(this).val(''); // Geçmiş sonuna gelince input'u temizle
                }
                break;
        }
    });

    // Pencere yönetimi için gerekli değişkenler
    let isDragging = false;
    let currentZIndex = 100;

    // Pencereleri sürüklenebilir ve boyutlandırılabilir yap
    $('.window').each(function() {
        $(this).draggable({
            handle: '.window-header',
            containment: '.desktop',
            start: function() {
                isDragging = true;
                bringToFront($(this));
            },
            stop: function() {
                isDragging = false;
            }
        }).resizable({
            handles: 'all', // Tüm kenarlardan boyutlandırma
            minHeight: 300,
            minWidth: 500,
            containment: '.desktop',
            start: function() {
                bringToFront($(this));
            },
            resize: function() {
                // Terminal içeriğini yeniden düzenle
                const windowHeight = $(this).height();
                const headerHeight = $('.window-header').height();
                const inputHeight = $('.terminal-input-line').height();
                
                $('.window-content').height(windowHeight - headerHeight);
                $('.terminal-output-wrapper').height(windowHeight - headerHeight - inputHeight - 20);
            }
        });
    });

    // Pencereyi öne getirme fonksiyonu
    function bringToFront(window) {
        currentZIndex++;
        window.css('z-index', currentZIndex);
    }

    // Pencere tıklama olayı
    $('.window').mousedown(function() {
        if (!isDragging) {
            bringToFront($(this));
        }
    });

    // Pencere kontrolleri
    $('.close-btn').click(function(e) {
        e.stopPropagation();
        $(this).closest('.window').hide();
    });

    $('.minimize-btn').click(function(e) {
        e.stopPropagation();
        $(this).closest('.window').hide();
    });

    $('.maximize-btn').click(function(e) {
        e.stopPropagation();
        const window = $(this).closest('.window');
        window.toggleClass('maximized');
        
        if (window.hasClass('maximized')) {
            window.data('original-pos', {
                top: window.css('top'),
                left: window.css('left'),
                width: window.css('width'),
                height: window.css('height')
            });
            
            window.css({
                top: '0',
                left: '0',
                width: '100%',
                height: 'calc(100% - 40px)' // taskbar için alan bırak
            });
        } else {
            const originalPos = window.data('original-pos');
            window.css(originalPos);
        }
    });

    // Masaüstü ikonları
    $('#terminal-icon').click(function() {
        // Önce firewall durumunu kontrol et
        if (firewallActive) {
            // Güvenlik duvarı aktifse, terminal açılmasını engelle ve uyarı göster
            showNotification('error', 'Terminal erişimi engellendi! Güvenlik duvarını kapatın.');
            
            // Ekrana kırmızı flaş efekti
            $('.container').addClass('shake');
            setTimeout(() => {
                $('.container').removeClass('shake');
            }, 500);
            
            // Hata sesi çal
            $.post(`https://${GetParentResourceName()}/playErrorSound`);
            return;
        }

        const terminalWindow = $('#terminal-window');
        if (!terminalWindow.is(':visible')) {
            terminalWindow.show().css({
                'top': '50px',
                'left': '50px'
            });
            currentZIndex++;
            terminalWindow.css('z-index', currentZIndex);
        }
        $('#terminal-input').focus();
    });

    $('#chat-icon').click(function() {
        if (!isLoggedIn) {
            // Terminal mesajı yerine bildirim göster
            const notification = `
                <div class="notification error">
                    <i class="fas fa-exclamation-circle"></i>
                    Chat uygulamasını kullanmak için giriş yapmalısınız!
                </div>
            `;
            $('body').append(notification);
            
            // 3 saniye sonra bildirimi kaldır
            setTimeout(() => {
                $('.notification').fadeOut(500, function() {
                    $(this).remove();
                });
            }, 3000);

            // Login penceresini aç
            setTimeout(() => {
                $('#login-window').show().css({
                    'top': '70px',
                    'left': '70px'
                });
                $('#login-username').focus();
            }, 500);
            
            return;
        }
        
        $('#chat-window').show().css({
            'top': '70px',
            'left': '70px'
        });
        bringToFront($('#chat-window'));
    });

    // Terminal focus
    $('.terminal-content, #terminal-input').click(function(e) {
        e.stopPropagation();
        $('#terminal-input').focus();
    });

    // City Database fonksiyonları
    function openCityDB() {
        $('#city-db-window').show().css({
            'top': '60px',
            'left': '60px'
        });
        bringToFront($('#city-db-window'));
        loadCitizensData();
    }

    function loadCitizensData() {
        $.post(`https://${GetParentResourceName()}/getCitizensData`, {}, function(citizens) {
            updateCitizensTable(citizens);
        });
    }

    function updateCitizensTable(citizens) {
        const tbody = $('#citizens-list');
        tbody.empty();

        citizens.forEach(citizen => {
            const row = `
                <tr>
                    <td>${citizen.firstname} ${citizen.lastname}</td>
                    <td>${citizen.phone}</td>
                    <td>${citizen.citizenid}</td>
                    <td>${citizen.injail ? `<span class="jail-status">Hapiste (${citizen.jailtime} ay)</span>` : 'Serbest'}</td>
                </tr>
            `;
            tbody.append(row);
        });
    }

    // Tarih formatlama fonksiyonu
    function formatLastSeen(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return 'Bugün';
        } else if (diffDays === 1) {
            return 'Dün';
        } else {
            return `${diffDays} gün önce`;
        }
    }

    // Arama fonksiyonu
    $('#city-db-search').on('input', function() {
        const searchTerm = $(this).val().toLowerCase();
        $('#citizens-list tr').each(function() {
            const text = $(this).text().toLowerCase();
            $(this).toggle(text.includes(searchTerm));
        });
    });

    // Register işlemi
    $('#register-submit').click(function() {
        const username = $('#register-username').val().trim();
        const password = $('#register-password').val();
        const confirmPassword = $('#register-password-confirm').val();
        
        // Hata mesajını temizle
        $('#register-error').text('');
        
        if (!username || !password || !confirmPassword) {
            $('#register-error').text('Tüm alanları doldurun!');
            return;
        }
        
        if (password !== confirmPassword) {
            $('#register-error').text('Şifreler eşleşmiyor!');
            return;
        }
        
        // Loading durumu
        $('#register-submit').prop('disabled', true).text('Kaydediliyor...');
        
        $.post(`https://${GetParentResourceName()}/registerUser`, JSON.stringify({
            username: username,
            password: password
        }));
    });

    // Login işlemi
    $('#login-submit').click(function() {
        const username = $('#login-username').val().trim();
        const password = $('#login-password').val();
        
        // Hata mesajını temizle
        $('#login-error').text('');
        
        if (!username || !password) {
            $('#login-error').text('Tüm alanları doldurun!');
            return;
        }
        
        // Loading durumu
        $('#login-submit').prop('disabled', true).text('Giriş yapılıyor...');
        
        $.post(`https://${GetParentResourceName()}/loginUser`, JSON.stringify({
            username: username,
            password: password
        }));
    });

    // Chat mesajlarını yükle
    function loadChatMessages() {
        $.post(`https://${GetParentResourceName()}/getChatMessages`, {}, function(messages) {
            const chatMessages = $('#chat-messages');
            chatMessages.empty();
            
            // Mesajları tersine çevir (en eski mesaj en üstte olacak)
            messages.reverse().forEach(message => {
                appendChatMessage(message);
            });
            
            scrollChatToBottom();
        });
    }

    // Yeni mesaj gönder
    $('#chat-send').click(sendChatMessage);
    $('#chat-input').on('keypress', function(e) {
        if (e.which === 13) { // Enter tuşu
            sendChatMessage();
        }
    });

    function sendChatMessage() {
        const input = $('#chat-input');
        const message = input.val().trim();
        
        if (message) {
            $.post(`https://${GetParentResourceName()}/sendChatMessage`, JSON.stringify({
                message: message
            }));
            
            input.val('').focus();
        }
    }

    // Yeni mesaj al
    window.addEventListener('message', function(event) {
        const data = event.data;
        
        switch(data.action) {
            case "newChatMessage":
                appendChatMessage(data.data);
                scrollChatToBottom();
                // Eğer chat penceresi açık değilse bildirim göster
                if (!$('#chat-window').is(':visible')) {
                    showNotification('success', 'Yeni mesaj: ' + data.data.sender_username);
                }
                break;
            
            case "loginResponse":
                if (data.data.success) {
                    currentUsername = data.data.username;
                    loadChatMessages(); // Giriş yapınca mesajları yükle
                }
                break;
        }
    });

    // Mesaj ekle
    function appendChatMessage(message) {
        const chatMessages = $('#chat-messages');
        const isOwnMessage = message.sender_username === currentUsername;
        const messageHtml = `
            <div class="chat-message ${isOwnMessage ? 'own' : 'other'}">
                <div class="message-header">
                    ${isOwnMessage ? 'Sen' : message.sender_username}
                    <span class="message-time">${formatMessageTime(message.created_at)}</span>
                </div>
                <div class="message-content">${escapeHtml(message.message)}</div>
            </div>
        `;
        
        // Yeni mesajı en alta ekle
        chatMessages.append(messageHtml);
    }

    // Scroll to bottom
    function scrollChatToBottom() {
        const chatMessages = $('#chat-messages');
        chatMessages.scrollTop(chatMessages[0].scrollHeight);
    }

    // Zaman formatla
    function formatMessageTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('tr-TR', { 
            hour: '2-digit', 
            minute: '2-digit'
        });
    }

    // HTML escape
    function escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Chat penceresi açıldığında mesajları yükle
    $('#chat-icon').click(function() {
        if (isLoggedIn) {
            loadChatMessages();
        }
    });

    // Mail sistemi için gerekli değişkenler
    let currentMails = [];

    // Mail ikonu tıklama olayı
    $(document).on('click', '#mail-icon', function() {
        console.log('Mail icon clicked'); // Debug için

        if (!isLoggedIn) {
            showNotification('error', 'Mail uygulamasını kullanmak için giriş yapmalısınız!');
            setTimeout(() => {
                $('#login-window').show().css({
                    'top': '70px',
                    'left': '70px'
                });
            }, 500);
            return;
        }

        // Mail penceresini aç
        $('#mail-window').show().css({
            'top': '70px',
            'left': '70px'
        });
        
        // Pencereyi öne getir
        bringToFront($('#mail-window'));
        
        // Mail editörünü başlat
        initMailEditor();
        
        // Mailleri yükle
        loadMails();
    });

    // Mail editörünü başlat fonksiyonunu güncelle
    function initMailEditor() {
        if (!mailEditor) {
            mailEditor = new Quill('#mail-editor-container', {
                theme: 'snow',
                modules: {
                    toolbar: [
                        ['bold', 'italic', 'underline'],
                        [{ 'color': [] }],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        ['link', 'image'],
                        ['clean']
                    ]
                },
                placeholder: 'Mesajınızı yazın...'
            });

            // Görsel ekleme özelleştirmesi
            const toolbar = mailEditor.getModule('toolbar');
            toolbar.addHandler('image', () => {
                $('.image-url-popup').show();
                $('#image-url-input').focus().val('');
            });

            // Görsel ekleme butonu
            $('#add-image-btn').click(function() {
                const url = $('#image-url-input').val().trim();
                
                if (url) {
                    const img = new Image();
                    img.onload = () => {
                        const range = mailEditor.getSelection(true);
                        mailEditor.insertEmbed(range.index, 'image', url);
                        
                        // Görsele tıklanabilir özelliği ekle
                        const addedImage = mailEditor.root.querySelector('img[src="' + url + '"]');
                        if (addedImage) {
                            addedImage.addEventListener('click', function() {
                                showImageResizePopup(this);
                            });
                        }
                        
                        $('.image-url-popup').hide();
                    };
                    img.onerror = () => {
                        showNotification('error', 'Geçersiz görsel URL\'si!');
                    };
                    img.src = url;
                } else {
                    showNotification('error', 'Lütfen bir görsel URL\'si girin!');
                }
            });

            // Görsel boyutlandırma popup'ını göster
            function showImageResizePopup(image) {
                const currentWidth = image.width;
                const currentHeight = image.height;
                
                $('.image-resize-popup').remove(); // Varolan popup'ı kaldır
                
                const popup = $(`
                    <div class="image-resize-popup">
                        <div class="image-resize-content">
                            <div class="size-buttons">
                                <button data-size="small">Küçük</button>
                                <button data-size="medium">Orta</button>
                                <button data-size="large">Büyük</button>
                                <button data-size="original">Orijinal</button>
                            </div>
                            <div class="custom-size">
                                <input type="number" id="custom-width" placeholder="Genişlik" value="${currentWidth}">
                                <span>x</span>
                                <input type="number" id="custom-height" placeholder="Yükseklik" value="${currentHeight}">
                                <button id="apply-custom-size">Uygula</button>
                            </div>
                            <button id="close-resize-popup">Kapat</button>
                        </div>
                    </div>
                `);
                
                $('body').append(popup);
                
                // Hazır boyut butonları
                $('.size-buttons button').click(function() {
                    const size = $(this).data('size');
                    switch(size) {
                        case 'small':
                            image.style.width = '200px';
                            break;
                        case 'medium':
                            image.style.width = '400px';
                            break;
                        case 'large':
                            image.style.width = '600px';
                            break;
                        case 'original':
                            image.style.width = 'auto';
                            break;
                    }
                    image.style.height = 'auto'; // En boy oranını koru
                });
                
                // Özel boyut uygula
                $('#apply-custom-size').click(function() {
                    const width = $('#custom-width').val();
                    const height = $('#custom-height').val();
                    if (width) image.style.width = width + 'px';
                    if (height) image.style.height = height + 'px';
                });
                
                // Popup'ı kapat
                $('#close-resize-popup').click(function() {
                    $('.image-resize-popup').remove();
                });
            }

            // İptal butonu
            $('#cancel-image-btn').click(function() {
                $('.image-url-popup').hide();
            });

            // Enter tuşu ile görsel ekleme
            $('#image-url-input').keypress(function(e) {
                if (e.which === 13) { // Enter tuşu
                    $('#add-image-btn').click();
                }
            });

            // ESC tuşu ile popup'ı kapatma
            $(document).keyup(function(e) {
                if (e.key === "Escape") {
                    $('.image-url-popup').hide();
                }
            });
        }
    }

    // Mail gönderme butonunu güncelle
    $(document).on('click', '#send-mail-btn', function() {
        const receiver = $('#mail-to-username').val().trim();
        const subject = $('#mail-subject').val().trim();
        const content = mailEditor ? mailEditor.root.innerHTML : '';
        
        if (!receiver || !subject || !content) {
            showNotification('error', 'Tüm alanları doldurun!');
            return;
        }
        
        $.post(`https://${GetParentResourceName()}/sendMail`, JSON.stringify({
            receiver: receiver,
            subject: subject,
            content: content,
            sender: currentUsername
        }));
    });

    // Yeni mail butonunu güncelle
    $(document).on('click', '#new-mail-btn', function() {
        $('.mail-view').hide();
        $('.mail-compose').show();
        if (mailEditor) {
            mailEditor.setText('');
        }
        $('#mail-to-username').val('').focus();
        $('#mail-subject').val('');
    });

    // Mail penceresi kapatma butonu
    $(document).on('click', '#mail-window .close-btn', function() {
        $('#mail-window').hide();
    });

    // İptal butonu
    $(document).on('click', '#cancel-mail-btn', function() {
        $('.mail-compose').hide();
        $('.mail-view').show();
    });

    // Mail listesini yükle
    function loadMails() {
        $.post(`https://${GetParentResourceName()}/getMails`, {}, function(mails) {
            console.log('Loaded mails:', mails);
            currentMails = mails;
            
            const mailList = $('#mail-list');
            mailList.empty();
            
            if (mails && mails.length > 0) {
                mails.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                
                mails.forEach(mail => {
                    const isUnread = !mail.is_read;
                    const isReceived = mail.receiver_username === currentUsername;
                    const statusIcon = getMailStatusIcon(mail);
                    const directionIcon = getMailDirectionIcon(mail);
                    
                    const mailItem = `
                        <div class="mail-item ${isUnread ? 'unread' : 'read'}" data-id="${mail.id}">
                            <div class="mail-direction-icon">
                                ${directionIcon}
                            </div>
                            <div class="mail-content-wrapper">
                                <div class="mail-item-header">
                                    <span class="mail-item-from ${isUnread ? 'unread-text' : 'read-text'}">
                                        ${mail.sender_username}@kslab.onion
                                    </span>
                                    <div class="mail-item-info">
                                        <span class="mail-status-icon">${statusIcon}</span>
                                        <span class="mail-item-time">${formatMailTime(mail.created_at)}</span>
                                    </div>
                                </div>
                                <div class="mail-item-subject ${isUnread ? 'unread-text' : 'read-text'}">
                                    ${mail.subject}
                                </div>
                            </div>
                        </div>
                    `;
                    mailList.append(mailItem);
                });
            } else {
                mailList.append(`
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <p>Mail kutunuz boş</p>
                    </div>
                `);
            }
        });
    }

    // Mail durumu ikonunu al
    function getMailStatusIcon(mail) {
        const isReceived = mail.receiver_username === currentUsername;
        
        if (isReceived) {
            // Alınan mailler için ikon yok
            return '';
        } else {
            // Gönderilen mailler için durum ikonları
            if (mail.is_delivered && mail.is_read) {
                return '<i class="fas fa-check-double mail-status-read"></i>'; // Mavi çift tik
            } else if (mail.is_delivered) {
                return '<i class="fas fa-check-double mail-status-delivered"></i>'; // Gri çift tik
            } else {
                return '<i class="fas fa-check mail-status-sent"></i>'; // Tek tik
            }
        }
    }

    // Mail yönü ikonunu al
    function getMailDirectionIcon(mail) {
        const isReceived = mail.receiver_username === currentUsername;
        
        if (isReceived) {
            return '<i class="fas fa-arrow-down mail-direction-received"></i>'; // Gelen mail
        } else {
            return '<i class="fas fa-arrow-up mail-direction-sent"></i>'; // Giden mail
        }
    }

    // Mail seçildiğinde
    $(document).on('click', '.mail-item', function() {
        const mailId = parseInt($(this).data('id'));
        const mail = currentMails.find(m => m.id === mailId);
        
        if (mail) {
            $('.mail-compose').hide();
            $('.mail-view').html(`
                <div class="mail-view-header">
                    <div><strong>Kimden:</strong> ${mail.sender_username}@kslab.onion</div>
                    <div><strong>Kime:</strong> ${mail.receiver_username}@kslab.onion</div>
                    <div><strong>Konu:</strong> ${mail.subject}</div>
                    <div><strong>Tarih:</strong> ${formatMailTime(mail.created_at)}</div>
                    <div class="mail-view-actions">
                        <button class="delete-mail-btn" data-id="${mail.id}">
                            <i class="fas fa-trash"></i> Sil
                        </button>
                    </div>
                </div>
                <div class="mail-view-content">
                    ${mail.content}
                </div>
            `).show();
            
            // Mail alıcısıysak ve mail okunmamışsa
            if (mail.receiver_username === currentUsername && !mail.is_read) {
                // Sunucuya bildir
                $.post(`https://${GetParentResourceName()}/markMailAsRead`, JSON.stringify({
                    mailId: mailId
                }));
                
                // Yerel UI'ı güncelle
                $(this).removeClass('unread');
                mail.is_read = true;
                mail.read_at = new Date().toISOString();
                updateMailStatus(mail);
            }
        }
    });

    // Mail silme
    $(document).on('click', '.delete-mail-btn', function(e) {
        e.stopPropagation();
        const mailId = $(this).data('id');
        
        showConfirmDialog({
            title: 'Mail Sil',
            message: 'Bu maili silmek istediğinizden emin misiniz?',
            onConfirm: () => {
                $.post(`https://${GetParentResourceName()}/qb-hackingtablet:deleteMail`, JSON.stringify({
                    mailId: mailId
                }));
            }
        });
    });

    // Event listener for NUI messages
    window.addEventListener('message', function(event) {
        const data = event.data;
        
        if (data.type === "deleteMailResponse") {
            if (data.status === "success") {
                // Mail listesinden kaldır
                $(`.mail-item[data-id="${data.mailId}"]`).fadeOut(300, function() {
                    $(this).remove();
                });
                
                // Mail görüntüleme ekranını temizle
                $('.mail-view').html(`
                    <div class="empty-state">
                        <i class="fas fa-envelope"></i>
                        <p>Mail seçilmedi</p>
                    </div>
                `);
                
                // Bildirim göster
                showNotification('success', 'Mail başarıyla silindi');
                
                // Mail listesini güncelle
                currentMails = currentMails.filter(m => m.id !== data.mailId);
                
                // Mail listesini yeniden yükle
                loadMails();
            } else {
                showNotification('error', data.message || 'Mail silinirken bir hata oluştu');
            }
        }
    });

    // Özel onay kutusu göster
    function showConfirmDialog({ title, message, onConfirm }) {
        const dialog = `
            <div class="confirm-dialog">
                <div class="confirm-dialog-content">
                    <div class="confirm-dialog-header">
                        <h3>${title}</h3>
                    </div>
                    <div class="confirm-dialog-body">
                        <p>${message}</p>
                    </div>
                    <div class="confirm-dialog-footer">
                        <button class="confirm-dialog-btn confirm">Evet</button>
                        <button class="confirm-dialog-btn cancel">Hayır</button>
                    </div>
                </div>
            </div>
        `;
        
        $('#mail-window').append(dialog);
        
        // Event listeners
        $('.confirm-dialog .confirm').click(function() {
            onConfirm();
            $('.confirm-dialog').remove();
        });
        
        $('.confirm-dialog .cancel').click(function() {
            $('.confirm-dialog').remove();
        });
    }

    // Mail zamanı formatla
    function formatMailTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('tr-TR', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Debug için yardımcı fonksiyon
    function logMailData() {
        console.log('Current mails:', currentMails);
        console.log('Mail items:', $('.mail-item').length);
        console.log('Mail view content:', $('.mail-view').html());
    }

    // Bildirim göster
    function showNotification(type, message) {
        const notification = `
            <div class="notification ${type}">
                <i class="fas fa-${type === 'success' ? 'check' : 'exclamation'}-circle"></i>
                ${message}
            </div>
        `;
        $('body').append(notification);
        
        setTimeout(() => {
            $('.notification').fadeOut(500, function() {
                $(this).remove();
            });
        }, 3000);
    }

    // Pencere kontrolleri için genel fonksiyon
    function initializeWindowControls(windowId) {
        const $window = $(`#${windowId}`);
        const $header = $window.find('.window-header');
        
        let isDragging = false;
        let isResizing = false;
        let startX, startY, startWidth, startHeight, initialX, initialY;
        
        // Pencere sürükleme
        $header.mousedown(function(e) {
            if (e.target.closest('.window-controls')) {
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                initialX = $window.offset().left;
                initialY = $window.offset().top;
            }
        });

        $(document).mousemove(function(e) {
            if (isDragging) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                $window.css({
                    left: initialX + dx,
                    top: initialY + dy
                });
            }
        });

        $(document).mouseup(function() {
            isDragging = false;
        });

        // Pencere boyutlandırma
        $header.find('.maximize-btn').mousedown(function(e) {
            isResizing = true;
            startWidth = $window.width();
            startHeight = $window.height();
            startX = e.clientX;
            startY = e.clientY;
        });

        $(document).mousemove(function(e) {
            if (isResizing) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                $window.css({
                    width: startWidth + dx,
                    height: startHeight + dy
                });
            }
        });

        $(document).mouseup(function() {
            isResizing = false;
        });

        // Pencere kapatma
        $header.find('.close-btn').click(function() {
            $window.hide();
        });
    }

    // Saat güncelleme fonksiyonu
    function updateClock() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        $('.taskbar-time').text(`${hours}:${minutes}`);
    }

    // Sayfa yüklendiğinde saati başlat
    updateClock();
    // Her 1 dakikada bir saati güncelle
    setInterval(updateClock, 60000);

    // Firewall icon click events
    $('#firewall-icon, .taskbar-firewall').click(function() {
        $('#firewall-window').show().css({
            'top': '70px',
            'left': '70px'
        });
        bringToFront($('#firewall-window'));
    });

    // Firewall toggle button click event
    $('#firewall-toggle').click(function() {
        firewallActive = !firewallActive;
        updateFirewallStatus();
        
        // Sunucuya firewall durumunu bildir
        $.post(`https://${GetParentResourceName()}/updateFirewallStatus`, JSON.stringify({
            active: firewallActive
        }));
    });

    // Firewall durumunu güncelle
    function updateFirewallStatus() {
        if (firewallActive) {
            $('.taskbar-firewall').addClass('active');
            $('.status-value').removeClass('inactive').addClass('active').text('Aktif');
            $('#firewall-toggle').addClass('active').text('Bağlantıyı Sonlandır');
        } else {
            $('.taskbar-firewall').removeClass('active');
            $('.status-value').removeClass('active').addClass('inactive').text('Devre Dışı');
            $('#firewall-toggle').removeClass('active').text('Bağlan');
        }
    }

    // Terminal çıktısı için stil ekle
    function appendTerminalOutput(message, type = 'normal') {
        const terminalOutput = $('#terminal-output');
        let styledMessage = message;
        
        if (type === 'error') {
            styledMessage = `<span style="color: #ff0000;">${message}</span>`;
        } else if (type === 'success') {
            styledMessage = `<span style="color: #00ff00;">${message}</span>`;
        }
        
        terminalOutput.append(`${styledMessage}\n`);
        
        // Otomatik scroll
        const terminal = $('.terminal-output-wrapper');
        terminal.scrollTop(terminal[0].scrollHeight);
    }

    // Event listener'ı güncelle
    window.addEventListener('message', function(event) {
        const data = event.data;
        
        switch(data.action) {
            // ... diğer case'ler ...
            case "locateError":
                appendTerminalOutput(data.message, 'error');
                break;
            // ... diğer case'ler ...
        }
    });

    // Mail durumu güncelleme
    function updateMailStatus(mail) {
        const mailItem = $(`.mail-item[data-id="${mail.id}"]`);
        const statusIcon = mailItem.find('.mail-status-icon');
        
        if (mail.sender_username === currentUsername) {
            if (mail.is_read) {
                statusIcon.html('<i class="fas fa-check-double mail-status-read"></i>');
            } else if (mail.is_delivered) {
                statusIcon.html('<i class="fas fa-check-double mail-status-delivered"></i>');
            } else {
                statusIcon.html('<i class="fas fa-check mail-status-sent"></i>');
            }
        }
    }

    // Mail okundu güncellemesi al
    window.addEventListener('message', function(event) {
        const data = event.data;
        
        if (data.action === "mailReadUpdate") {
            const mail = currentMails.find(m => m.id === data.data.mailId);
            if (mail) {
                mail.is_read = true;
                mail.read_at = data.data.readAt;
                updateMailStatus(mail);
            }
        }
    });

    // Ağ bağlantı durumunu kontrol et
    function checkNetworkConnection() {
        if (!isConnectedToNetwork) {
            $('#login-submit').prop('disabled', true);
            $('#register-submit').prop('disabled', true);
            showNotification('error', 'Ağ bağlantısı yok! Lütfen bir ağa bağlanın.');
            return false;
        }
        return true;
    }

    // Ağ bağlantı fonksiyonu
    function connectToNetwork(network) {
        $('.network-item').removeClass('connected');
        $(`#network-${network}`).addClass('connected');
        
        isConnectedToNetwork = true;
        currentNetwork = network;
        
        // Ağ durumunu kontrol et
        checkNetwork();
        
        // Bağlantı durumunu güncelle
        updateNetworkStatus();
        
        // Login ve register butonlarını aktif et
        $('#login-submit').prop('disabled', false);
        $('#register-submit').prop('disabled', false);
        
        showNotification('success', `${network} ağına bağlandınız!`);
    }

    // Ağ durumunu güncelle
    function updateNetworkStatus() {
        if (isConnectedToNetwork) {
            $('.network-status').html(`<i class="fas fa-wifi"></i> ${currentNetwork}`);
        } else {
            $('.network-status').html('<i class="fas fa-wifi-slash"></i> Bağlı değil');
        }
    }

    // Ağ menüsünü aç/kapat
    $('.network-status').click(function() {
        $('.network-menu').toggleClass('show');
    });

    // Login ve register eventlerini güncelle
    $('#login-submit').click(function() {
        if (!checkNetworkConnection()) return;
        
        // Mevcut login kodu...
    });

    $('#register-submit').click(function() {
        if (!checkNetworkConnection()) return;
        
        // Mevcut register kodu...
    });

    // Network item click eventi ekle
    $(document).on('click', '.network-item', function() {
        const networkId = $(this).attr('id').replace('network-', '');
        connectToNetwork(networkId);
        $('.network-menu').removeClass('show');
    });

    // Register işlemini güncelle
    $(document).on('click', '#register-submit', function() {
        if (!checkNetworkConnection()) {
            showNotification('error', 'Ağ bağlantısı yok! Lütfen bir ağa bağlanın.');
            return;
        }

        const username = $('#register-username').val().trim();
        const password = $('#register-password').val();
        const confirmPassword = $('#register-password-confirm').val();
        
        $('#register-error').text('');
        
        if (!username || !password || !confirmPassword) {
            $('#register-error').text('Tüm alanları doldurun!');
            return;
        }
        
        if (password !== confirmPassword) {
            $('#register-error').text('Şifreler eşleşmiyor!');
            return;
        }
        
        $('#register-submit').prop('disabled', true).text('Kaydediliyor...');
        
        $.post(`https://${GetParentResourceName()}/registerUser`, JSON.stringify({
            username: username,
            password: password
        }));
    });

    // Login işlemini güncelle
    $(document).on('click', '#login-submit', function() {
        if (!checkNetworkConnection()) {
            showNotification('error', 'Ağ bağlantısı yok! Lütfen bir ağa bağlanın.');
            return;
        }

        const username = $('#login-username').val().trim();
        const password = $('#login-password').val();
        
        $('#login-error').text('');
        
        if (!username || !password) {
            $('#login-error').text('Tüm alanları doldurun!');
            return;
        }
        
        $('#login-submit').prop('disabled', true).text('Giriş yapılıyor...');
        
        $.post(`https://${GetParentResourceName()}/loginUser`, JSON.stringify({
            username: username,
            password: password
        }));
    });

    // Sayfa yüklendiğinde butonları devre dışı bırak
    $(document).ready(function() {
        $('#login-submit').prop('disabled', true);
        $('#register-submit').prop('disabled', true);
        updateNetworkStatus(); // Ağ durumunu güncelle
    });

    // Dışarı tıklandığında ağ menüsünü kapat
    $(document).click(function(e) {
        if (!$(e.target).closest('.network-status, .network-menu').length) {
            $('.network-menu').removeClass('show');
        }
    });

    // Hesap makinesi fonksiyonları
    let calculator = {
        displayValue: '0',
        firstOperand: null,
        waitingForSecondOperand: false,
        operator: null,
    };

    function inputDigit(digit) {
        const { displayValue, waitingForSecondOperand } = calculator;

        if (waitingForSecondOperand === true) {
            calculator.displayValue = digit;
            calculator.waitingForSecondOperand = false;
        } else {
            calculator.displayValue = displayValue === '0' ? digit : displayValue + digit;
        }
    }

    function inputDecimal(dot) {
        if (calculator.waitingForSecondOperand === true) {
            calculator.displayValue = "0."
            calculator.waitingForSecondOperand = false;
            return;
        }

        if (!calculator.displayValue.includes(dot)) {
            calculator.displayValue += dot;
        }
    }

    function handleOperator(nextOperator) {
        const { firstOperand, displayValue, operator } = calculator;
        const inputValue = parseFloat(displayValue);

        if (operator && calculator.waitingForSecondOperand) {
            calculator.operator = nextOperator;
            return;
        }

        if (firstOperand === null && !isNaN(inputValue)) {
            calculator.firstOperand = inputValue;
        } else if (operator) {
            const result = calculate(firstOperand, inputValue, operator);
            calculator.displayValue = `${parseFloat(result.toFixed(7))}`;
            calculator.firstOperand = result;
        }

        calculator.waitingForSecondOperand = true;
        calculator.operator = nextOperator;
    }

    function calculate(firstOperand, secondOperand, operator) {
        switch (operator) {
            case '+': return firstOperand + secondOperand;
            case '-': return firstOperand - secondOperand;
            case '*': return firstOperand * secondOperand;
            case '/': return firstOperand / secondOperand;
            default: return secondOperand;
        }
    }

    function resetCalculator() {
        calculator.displayValue = '0';
        calculator.firstOperand = null;
        calculator.waitingForSecondOperand = false;
        calculator.operator = null;
    }

    function updateDisplay() {
        const display = document.querySelector('.calculator-screen');
        display.value = calculator.displayValue;
    }

    // Event listeners
    $(document).on('click', '.calculator-keys button', function(e) {
        const { target } = e;
        const { value } = target;

        switch (value) {
            case '+':
            case '-':
            case '*':
            case '/':
            case '=':
                handleOperator(value);
                break;
            case '.':
                inputDecimal(value);
                break;
            case 'all-clear':
                resetCalculator();
                break;
            default:
                if (Number.isInteger(parseFloat(value))) {
                    inputDigit(value);
                }
        }

        updateDisplay();
    });

    // Pencere yönetimi kısmına ekle (diğer pencere açma kodlarının yanına)
    $(document).on('click', '.desktop-icon[data-window="calculator"]', function() {
        const window = $('#calculator-window');
        
        // Pencere zaten açıksa öne getir
        if (window.is(':visible')) {
            window.show();
            bringToFront(window);
            return;
        }
        
        // Pencereyi aç
        window.show();
        bringToFront(window);
        
        // Pencereyi ortala
        const desktop = $('.desktop');
        const desktopWidth = desktop.width();
        const desktopHeight = desktop.height();
        const windowWidth = window.outerWidth();
        const windowHeight = window.outerHeight();
        
        window.css({
            left: (desktopWidth - windowWidth) / 2,
            top: (desktopHeight - windowHeight) / 2
        });
        
        // Pencereyi sürüklenebilir yap
        window.draggable({
            handle: '.window-header',
            containment: '.desktop'
        });
    });

    // Pencere kontrolleri
    $('#calculator-window .window-controls .window-close').click(function() {
        $('#calculator-window').hide();
    });

    $('#calculator-window .window-controls .window-minimize').click(function() {
        $('#calculator-window').hide();
        // Burada taskbar'a minimize edilebilir
    });

    $('#calculator-window .window-controls .window-maximize').click(function() {
        const $window = $('#calculator-window');
        $window.toggleClass('maximized');
    });

    // Pencereye tıklandığında öne getir
    $('#calculator-window').mousedown(function() {
        bringToFront($(this));
    });

    // Ağ kontrolü ve pencere yönetimi
    function checkNetwork() {
        const isDoodyNetwork = currentNetwork === 'doody';
        
        // İkonları kontrol et
        $('.desktop-icon').each(function() {
            const windowType = $(this).data('window');
            if (isDoodyNetwork) {
                // doody ağında sadece terminal ve hesap makinesi açılabilir
                if (windowType !== 'calculator' && windowType !== 'terminal') {
                    $(this).addClass('disabled');
                } else {
                    $(this).removeClass('disabled');
                }
                // Tor Browser'ı aktif et
                if (windowType === 'tor') {
                    $(this).removeClass('disabled');
                }
            } else {
                // Normal ağda Tor Browser'ı devre dışı bırak
                if (windowType === 'tor') {
                    $(this).addClass('disabled');
                } else {
                    $(this).removeClass('disabled');
                }
            }
        });
    }

    // Pencere açma olayını güncelle
    $(document).on('click', '.desktop-icon', function() {
        if ($(this).hasClass('disabled')) {
            if ($(this).data('window') === 'tor') {
                showNotification('error', 'Tor Browser sadece doody ağında kullanılabilir!');
            } else if (currentNetwork === 'doody') {
                showNotification('error', 'Bu uygulama doody ağında kullanılamaz!');
            }
            return;
        }
        
        const windowId = `#${$(this).data('window')}-window`;
        const $window = $(windowId);
        
        if ($window.is(':visible')) {
            bringToFront($window);
        } else {
            $window.show();
            bringToFront($window);
            centerWindow($window);
        }
    });

    // Ağ bağlantı fonksiyonunu güncelle
    function connectToNetwork(network) {
        $('.network-item').removeClass('connected');
        $(`#network-${network}`).addClass('connected');
        
        isConnectedToNetwork = true;
        currentNetwork = network;
        
        // Ağ durumunu kontrol et
        checkNetwork();
        
        // Bağlantı durumunu güncelle
        updateNetworkStatus();
        
        // Login ve register butonlarını aktif et
        $('#login-submit').prop('disabled', false);
        $('#register-submit').prop('disabled', false);
        
        showNotification('success', `${network} ağına bağlandınız!`);
    }

    // Tor Browser pencere kontrolleri
    $('#tor-window .window-controls .close-btn').click(function() {
        $('#tor-window').hide();
    });

    $('#tor-window .window-controls .minimize-btn').click(function() {
        $('#tor-window').hide();
    });

    $('#tor-window .window-controls .maximize-btn').click(function() {
        const $window = $('#tor-window');
        $window.toggleClass('maximized');
    });

    // Pencereye tıklandığında öne getir
    $('#tor-window').mousedown(function() {
        bringToFront($(this));
    });

    // Envanter öğelerini yükle
    function loadInventoryItems() {
        $.post(`https://${GetParentResourceName()}/getInventoryItems`, {}, function(items) {
            const itemList = $('#doody-shop-items');
            itemList.empty();
            
            if (items && items.length > 0) {
                items.forEach(item => {
                    const itemElement = $(`
                        <div class="shop-item" data-item="${item.name}">
                            <img src="nui://qb-inventory/html/images/${item.image}" alt="${item.label}">
                            <span class="item-label">${item.label}</span>
                            <span class="item-amount">Miktar: ${item.amount}</span>
                        </div>
                    `);
                    
                    itemList.append(itemElement);
                });
            } else {
                itemList.append(`
                    <div class="empty-state">
                        <i class="fas fa-box-open"></i>
                        <p>Envanterinizde eşya bulunamadı</p>
                    </div>
                `);
            }
        });
    }

    // Doody Shop kaydet butonu
    $('#doody-shop-save').click(function() {
        const selectedItem = $('.shop-item.selected');
        const amount = $('#doody-shop-amount').val();
        const price = $('#doody-shop-price').val();
        
        if (!price || price <= 0) {
            showNotification('error', 'Geçerli bir fiyat girin!');
            return;
        }
        
        // Benzersiz mağaza linki oluştur
        const storeLink = 'ds-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        
        // İlan bilgileri
        const itemData = {
            name: selectedItem.data('item'),
            label: selectedItem.find('.item-label').text(),
            amount: amount,
            price: price,
            storeLink: storeLink,
            image: selectedItem.find('img').attr('src').split('/').pop()
        };
        
        // Sunucuya gönder
        $.post(`https://${GetParentResourceName()}/createStoreListing`, JSON.stringify(itemData));
        
        // Doody Shop penceresini kapat
        $('#doody-shop-window').hide();
    });

    // Ürün silme butonu için event listener
    $(document).on('click', '.delete-listing', function(e) {
        e.stopPropagation();
        const storeLink = $(this).data('link');
        
        $.post(`https://${GetParentResourceName()}/deleteStoreListing`, JSON.stringify({
            storeLink: storeLink
        }));
    });

    // Mağaza sayfasını göster
    function showShopPage() {
        $('.tor-content').html(`
            <div class="shop-page">
                <div class="shop-header">
                    <h2>Doody Store</h2>
                </div>
                <div class="shop-items">
                    <div class="tor-listings"></div>
                </div>
            </div>
        `);

        // Mağaza listesini getir
        $.post(`https://${GetParentResourceName()}/getStoreListings`, {}, function(listings) {
            const container = $('.tor-listings');
            container.empty();
            
            if (listings && listings.length > 0) {
                listings.forEach(listing => {
                    const isOwner = listing.seller_username === currentUsername;
                    const listingHtml = `
                        <div class="tor-listing" data-store-link="${listing.store_link}">
                            <div class="listing-item">
                                <img src="nui://qb-inventory/html/images/${listing.image}" alt="${listing.item_label}">
                                <div class="listing-details">
                                    <h3>${listing.item_label}</h3>
                                    <p class="listing-amount">Miktar: ${listing.amount}</p>
                                    <p class="listing-price">$${listing.price}</p>
                                    <p class="seller-mail">Satıcı: ${listing.seller_username}@kslab.onion</p>
                                </div>
                                ${isOwner ? `
                                    <button class="delete-listing" data-link="${listing.store_link}">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    `;
                    container.append(listingHtml);
                });
            } else {
                container.html(`
                    <div class="empty-state">
                        <i class="fas fa-store-slash"></i>
                        <p>Henüz hiç ürün bulunmuyor</p>
                    </div>
                `);
            }
        });
    }

    // Tor Browser adres kontrolü
    $('.tor-address-bar .go-btn').click(function() {
        checkTorAddress();
    });

    // Enter tuşu ile de arama yapılabilsin
    $('.tor-address-bar input').keypress(function(e) {
        if (e.which === 13) {
            checkTorAddress();
        }
    });

    // Tor Browser içeriğini başlat
    function initializeTorBrowser() {
        $('.tor-content').html(`
            <div class="tor-welcome">
                <i class="fas fa-globe"></i>
                <h2>Tor Browser'a Hoş Geldiniz</h2>
                <p>Güvenli ve anonim gezinti için Tor ağındasınız.</p>
                <p>Store adresine girebilirsiniz veya terminalden doody-shop uygulamasından mağazaya ürün ekleyebilirsiniz.</p>
            </div>
        `);
    }

    // Adres kontrolü
    function checkTorAddress() {
        const address = $('.tor-address-bar input').val().toLowerCase();
        
        if (address === 'store' || address === 'shop') {
            showShopPage();
        } else if (address.startsWith('ds-')) {
            showListing(address);
        } else {
            showNotification('error', 'Geçersiz adres!');
        }
    }

    // Item seçme olayı
    $(document).on('click', '.shop-item', function() {
        $('.shop-item').removeClass('selected');
        $(this).addClass('selected');
    });

    // Devam Et butonu
    $('#doody-shop-next').click(function() {
        const selectedItem = $('.shop-item.selected');
        const amount = $('#doody-shop-amount').val();
        
        if (!selectedItem.length || !amount || amount < 1) {
            showNotification('error', 'Lütfen bir ürün ve geçerli miktar seçin!');
            return;
        }
        
        // Seçilen ürün bilgilerini göster
        const itemInfo = `
            <div class="selected-item-info">
                <img src="${selectedItem.find('img').attr('src')}" alt="${selectedItem.find('.item-label').text()}">
                <div class="selected-item-details">
                    <h4>${selectedItem.find('.item-label').text()}</h4>
                    <p>Miktar: ${amount}</p>
                </div>
            </div>
        `;
        
        $('.selected-item-info').html(itemInfo);
        
        // İkinci adıma geç
        $('#step-1').hide();
        $('#step-2').show();
    });

    // Geri butonu
    $('#doody-shop-back').click(function() {
        $('#step-2').hide();
        $('#step-1').show();
    });

    // Event listener ekleyelim
    window.addEventListener('message', function(event) {
        const data = event.data;
        
        switch(data.action) {
            // ... diğer case'ler ...
            
            case "listingCreated":
                if (data.data.success) {
                    showNotification('success', `İlan başarıyla oluşturuldu!<br>Mağaza Linki: ${data.data.storeLink}`);
                    // Tor Browser'ı aç ve mağaza sayfasını göster
                    $('#tor-window').show().css({
                        'top': '70px',
                        'left': '70px'
                    });
                    $('.tor-address-bar input').val('store');
                    showShopPage();
                }
                break;
                
            case "listingDeleted":
                showNotification(data.data.success ? 'success' : 'error', data.data.message);
                if (data.data.success) {
                    showShopPage(); // Listeyi yenile
                }
                break;
                
            case "updateListings":
                if ($('.tor-content .shop-page').length) {
                    showShopPage(); // Mağaza sayfası açıksa listeyi güncelle
                }
                break;
        }
    });

    // NChat mesaj gönderme olayları
    //$('.nchat-input button').click(function() {
    //    sendMessage();
    //});
    $('#send-message-btn').click(function() {
        sendMessage();
    });


    $('#share-exact-location-btn').click(function() {
        shareExactLocation();
    });

    $('#share-area-location-btn').click(function() {
        shareAreaLocation();
    });


    $('.nchat-input input').keypress(function(e) {
        if (e.which === 13) { // Enter tuşu
            sendMessage();
        }
    });

    // Pencere kapatıldığında odadan çık
    $('#nchat-window .close-btn').click(function() {
        const roomCode = $('.room-code span').text();
        if (roomCode && roomCode !== 'Bağlanılıyor...') {
            $.post(`https://${GetParentResourceName()}/leaveChatRoom`, JSON.stringify({
                roomCode: roomCode
            }));
        }
    });

    // Mesaj gönderme fonksiyonu
    function sendMessage() {
        const input = $('.nchat-input input');
        const message = input.val().trim();
        
        if (message) {
            const roomCode = $('.room-code span').text();
            if (roomCode && roomCode !== 'Bağlanılıyor...') {
                $.post(`https://${GetParentResourceName()}/sendNChatMessage`, JSON.stringify({
                    roomCode: roomCode,
                    message: {
                        type: 'text',
                        content: message
                    }
                }));
                
                input.val('').focus();
            }
        }
    }

    // Konum mesajı ekleme fonksiyonu
    function addMessage(sender, message, isSent = false, messageId) {
        console.log('Gelen mesaj:', message); // Debug için
        
        const sanitizedSender = $('<div>').text(sender).html();
        let messageContent;

        if (typeof message === 'object') {
            if (message.type === 'text') {
                messageContent = $('<div>').text(message.content).html();
            }
            else if (message.type === 'exact-location') {
                messageContent = `
                    <div class="location-message exact">
                        <div class="location-icon">
                            <i class="fas fa-map-marker-alt"></i>
                        </div>
                        <div class="location-content">
                            <div class="location-text">Konum paylaşıldı</div>
                            <button class="goto-location" data-coords='${JSON.stringify(message.coords)}'>
                                Konumu Görüntüle
                            </button>
                        </div>
                    </div>
                `;
            }
            else if (message.type === 'area-location') {
                messageContent = `
                    <div class="location-message area">
                        <div class="location-icon">
                            <i class="fas fa-circle"></i>
                        </div>
                        <div class="location-content">
                            <div class="location-text">Bölge paylaşıldı</div>
                            <button class="goto-area" data-coords='${JSON.stringify(message.coords)}' data-radius='${message.radius || 100}'>
                                Bölgeyi Görüntüle
                            </button>
                        </div>
                    </div>
                `;
            }
        } else {
            messageContent = $('<div>').text(message).html();
        }

        $('.nchat-messages').append(`
            <div class="message ${isSent ? 'sent' : 'received'}" data-message-id="${messageId}">
                <div class="sender">${sanitizedSender}</div>
                <div class="content">${messageContent}</div>
            </div>
        `);
        scrollToBottom();
    }

    // Konum paylaşma fonksiyonları
    function shareExactLocation() {
        const roomCode = $('.room-code span').text();
        if (roomCode && roomCode !== 'Bağlanılıyor...') {
            $.post(`https://${GetParentResourceName()}/getPlayerLocation`, {}, function(coords) {
                if (coords) {
                    $.post(`https://${GetParentResourceName()}/playSound`, JSON.stringify({
                        sound: "ATM_WINDOW",
                        soundset: "HUD_FRONTEND_DEFAULT_SOUNDSET"
                    }));
                    
                    $.post(`https://${GetParentResourceName()}/sendNChatMessage`, JSON.stringify({
                        roomCode: roomCode,
                        message: {
                            type: 'exact-location',
                            coords: coords
                        }
                    }));
                }
            });
        }
    }

    function shareAreaLocation() {
        const roomCode = $('.room-code span').text();
        if (roomCode && roomCode !== 'Bağlanılıyor...') {
            $.post(`https://${GetParentResourceName()}/getPlayerLocation`, {}, function(coords) {
                if (coords) {
                    $.post(`https://${GetParentResourceName()}/playSound`, JSON.stringify({
                        sound: "ATM_WINDOW",
                        soundset: "HUD_FRONTEND_DEFAULT_SOUNDSET"
                    }));
                    
                    $.post(`https://${GetParentResourceName()}/sendNChatMessage`, JSON.stringify({
                        roomCode: roomCode,
                        message: {
                            type: 'area-location',
                            coords: coords,
                            radius: 100.0
                        }
                    }));
                }
            });
        }
    }

    // Event listener'lar
    $(document).on('click', '.goto-location', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const coords = JSON.parse($(this).attr('data-coords'));
        console.log('Tam konum işaretleniyor:', coords);
        
        $.post(`https://${GetParentResourceName()}/markLocation`, JSON.stringify({
            coords: coords,
            type: 'exact'
        }));
    });

    $(document).on('click', '.goto-area', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const coords = JSON.parse($(this).attr('data-coords'));
        const radius = parseFloat($(this).attr('data-radius'));
        console.log('Alan konumu işaretleniyor:', coords, radius);
        
        $.post(`https://${GetParentResourceName()}/markLocation`, JSON.stringify({
            coords: coords,
            type: 'area',
            radius: radius
        }));
    });

    // Yeni mesaj geldiğinde
    window.addEventListener('message', function(event) {
        const data = event.data;
        
        if (data.action === "newChatMessage") {
            const msg = data.data.message;
            if (!$(`[data-message-id="${msg.id}"]`).length) {
                const isSent = msg.sender_name === currentUsername;
                addMessage(msg.sender_name, msg.content, isSent, msg.id);
            }
        }
    });

    function scrollToBottom() {
        const messages = $('.nchat-messages');
        messages.scrollTop(messages[0].scrollHeight);
    }

    function addSystemMessage(message) {
        if (!message || typeof message !== 'string') {
            return;
        }
        
        $('.nchat-messages').append(`
            <div class="message system">
                <div class="content">${message}</div>
            </div>
        `);
        scrollToBottom();
    }

    // Login response eventinde currentCitizenId'yi set et
    RegisterNetEvent('qb-hackingtablet:client:loginResponse')
    AddEventHandler('qb-hackingtablet:client:loginResponse', function(response) {
        if (response.success) {
            isLoggedIn = true;
            currentUsername = response.username;
            currentCitizenId = response.citizenid; // Bunu ekleyin
        }
    });

    // Pencereyi merkeze konumlandırma fonksiyonu
    function centerWindow(windowElement) {
        const container = $('.container');
        const window = $(windowElement);
        
        const left = (container.width() - window.width()) / 2;
        const top = (container.height() - window.height()) / 2;
        
        window.css({
            'left': left + 'px',
            'top': top + 'px'
        });
    }

    // NChat odası bağlantı fonksiyonu
    function connectToRoom(roomCode) {
        // Önce odayı oluştur
        $.post(`https://${GetParentResourceName()}/createChatRoom`, JSON.stringify({
            roomCode: roomCode
        }));

        // Sonra odaya katıl
        setTimeout(() => {
            $.post(`https://${GetParentResourceName()}/joinChatRoom`, JSON.stringify({
                roomCode: roomCode
            }), function(response) {
                if (response.success) {
                    $('.room-code span').text(roomCode);
                    $('.connection-status span').text('Bağlandı');
                    $('.nchat-messages').empty();
                    
                    // Önceki mesajları getir
                    $.post(`https://${GetParentResourceName()}/getRoomMessages`, JSON.stringify({
                        roomCode: roomCode
                    }), function(messages) {
                        if (messages && messages.length > 0) {
                            messages.forEach(msg => {
                                const isSent = msg.sender_username === currentUsername;
                                addMessage(msg.sender_username, msg.message, isSent);
                            });
                            scrollToBottom();
                        }
                    });
                    
                    addSystemMessage('Odaya bağlandınız!');
                    
                    // Pencereyi merkeze al
                    centerWindow('#nchat-window');
                } else {
                    $('.room-code span').text('Bağlantı hatası');
                    $('.connection-status span').text('Bağlantı kesildi');
                    addSystemMessage(response.message || 'Bağlantı hatası!');
                }
            });
        }, 100);
    }

    // Diğer pencereler için merkeze alma işlemlerini ekleyin
    $('.window').each(function() {
        $(this).on('show', function() {
            centerWindow(this);
        });
    });

    // Pencere sürükleme işlemi sonrası merkeze alma
    $('.window').on('dragstop', function() {
        if ($(this).is(':visible')) {
            centerWindow(this);
        }
    });

    // nchat-input div'ini güncelle
    function initializeNChatInput() {
        $('.nchat-input').html(`
            <div class="message-input">
                <div class="input-group">
                    <input type="text" placeholder="Mesajınızı yazın...">
                    <button class="send-btn" title="Mesaj Gönder">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
            <div class="location-buttons">
                <button class="share-exact-location" title="Tam Konum Paylaş">
                    <i class="fas fa-map-marker-alt"></i>
                </button>
                <button class="share-area-location" title="Alan Konumu Paylaş">
                    <i class="fas fa-circle"></i>
                </button>
            </div>
        `);
    }

    // NChat penceresi açıldığında input alanını başlat
    $(document).on('click', '#chat-icon', function() {
        if (isLoggedIn) {
            loadChatMessages();
            initializeNChatInput(); // Input alanını başlat
        }
    });

    // Konum paylaşma butonları için event listener'ları güncelle
    $(document).on('click', '.share-exact-location', function() {
        const roomCode = $('.room-code span').text();
        if (roomCode && roomCode !== 'Bağlanılıyor...') {
            // Önce oyuncunun konumunu al
            $.post(`https://${GetParentResourceName()}/getPlayerLocation`, {}, function(coords) {
                if (coords) {
                    // Konum bilgisini mesaj olarak gönder
                    $.post(`https://${GetParentResourceName()}/sendNChatMessage`, JSON.stringify({
                        roomCode: roomCode,
                        message: {
                            type: 'exact-location',
                            coords: coords
                        }
                    }));
                }
            });
        }
    });

    $(document).on('click', '.share-area-location', function() {
        const roomCode = $('.room-code span').text();
        if (roomCode && roomCode !== 'Bağlanılıyor...') {
            $.post(`https://${GetParentResourceName()}/getPlayerLocation`, {}, function(coords) {
                if (coords) {
                    // Ses efekti
                    $.post(`https://${GetParentResourceName()}/playSound`, JSON.stringify({
                        sound: "ATM_WINDOW",
                        soundset: "HUD_FRONTEND_DEFAULT_SOUNDSET"
                    }));
                    
                    // Alan konumu mesajı gönder
                    $.post(`https://${GetParentResourceName()}/sendNChatMessage`, JSON.stringify({
                        roomCode: roomCode,
                        message: {
                            type: 'area-location',
                            coords: coords,
                            radius: 200.0 // Yarıçapı 100.0 birim olarak ayarla
                        }
                    }));

                    // Haritada göster
                    $.post(`https://${GetParentResourceName()}/markLocation`, JSON.stringify({
                        coords: coords,
                        type: 'area',
                        radius: 200.0
                    }));
                }
            });
        }
    });

    // Mesaj gönderme butonu için event listener
    $(document).on('click', '.nchat-input .send-btn', function(e) {
        e.preventDefault();
        sendMessage();
    });

    // Enter tuşu ile mesaj gönderme
    $(document).on('keypress', '.nchat-input input', function(e) {
        if (e.which === 13) {
            e.preventDefault();
            sendMessage();
        }
    });
});