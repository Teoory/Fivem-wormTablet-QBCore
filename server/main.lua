local QBCore = exports['qb-core']:GetCoreObject()
local oxmysql = exports.oxmysql
local activeUsers = {}
-- Firewall durumlarını saklamak için tabloyu en başta tanımla
local playerFirewalls = {}
-- NChat odaları için tablo
local ChatRooms = {}

-- Tablo oluşturma
CreateThread(function()
    local tableName = "tablet_users"
    local createTableQuery = [[
        CREATE TABLE IF NOT EXISTS `tablet_users` (
            `id` int(11) NOT NULL AUTO_INCREMENT,
            `username` varchar(50) NOT NULL,
            `password` varchar(255) NOT NULL,
            `citizenid` varchar(50) NOT NULL,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `username` (`username`),
            UNIQUE KEY `citizenid` (`citizenid`)
        )
    ]]

    exports.oxmysql:execute(createTableQuery, function(result)
        if result then
            print('^2[qb-hackingtablet] Tablet users tablosu başarıyla oluşturuldu!^0')
        end
    end)
end)

-- Chat mesajları tablosunu güncelle
CreateThread(function()
    -- Önce eski tabloyu sil
    exports.oxmysql:execute('DROP TABLE IF EXISTS tablet_chat_messages')
    
    -- Yeni tabloyu oluştur
    local createChatTableQuery = [[
        CREATE TABLE IF NOT EXISTS `tablet_chat_messages` (
            `id` int(11) NOT NULL AUTO_INCREMENT,
            `sender_citizenid` varchar(50) NOT NULL,
            `sender_username` varchar(50) NOT NULL,
            `room_code` varchar(10) NOT NULL,
            `message` text NOT NULL,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]]

    exports.oxmysql:execute(createChatTableQuery, function(result)
        if result then
            print('^2[qb-hackingtablet] Chat mesajları tablosu başarıyla güncellendi!^0')
        end
    end)
end)

-- Mail tablosunu oluştur
CreateThread(function()
    local createMailTableQuery = [[
        CREATE TABLE IF NOT EXISTS `tablet_mails` (
            `id` int(11) NOT NULL AUTO_INCREMENT,
            `sender_username` varchar(50) NOT NULL,
            `receiver_username` varchar(50) NOT NULL,
            `subject` varchar(255) NOT NULL,
            `content` text NOT NULL,
            `is_read` tinyint(1) DEFAULT 0,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`)
        )
    ]]

    exports.oxmysql:execute(createMailTableQuery, function(result)
        if result then
            print('^2[qb-hackingtablet] Mail tablosu başarıyla oluşturuldu!^0')
        end
    end)
end)

-- Mail tablosunu güncelle
CreateThread(function()
    local alterTableQuery = [[
        ALTER TABLE tablet_mails 
        ADD COLUMN IF NOT EXISTS is_delivered TINYINT(1) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP NULL,
        ADD COLUMN IF NOT EXISTS read_at TIMESTAMP NULL
    ]]
    
    exports.oxmysql:execute(alterTableQuery)
end)

-- Item tanımlaması
QBCore.Functions.CreateUseableItem("worm-tablet", function(source)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    
    if Player then
        TriggerClientEvent("qb-hackingtablet:client:openTablet", src)
    end
end)

-- Rastgele IP oluşturma fonksiyonu
local function generateRandomIP()
    local segments = {}
    for i = 1, 4 do
        segments[i] = math.random(10, 99)
    end
    return table.concat(segments, ".")
end

-- Kullanıcı tableti açtığında
RegisterNetEvent('qb-hackingtablet:server:tabletOpened')
AddEventHandler('qb-hackingtablet:server:tabletOpened', function()
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    
    if Player then
        local userInfo = {
            source = src,
            name = Player.PlayerData.charinfo.firstname .. " " .. Player.PlayerData.charinfo.lastname,
            citizenid = Player.PlayerData.citizenid,
            ip = generateRandomIP(),
            timestamp = os.time()
        }
        
        activeUsers[src] = userInfo
        TriggerClientEvent('qb-hackingtablet:client:setUserInfo', src, userInfo)
        TriggerClientEvent('qb-hackingtablet:client:updateActiveUsers', -1, activeUsers)
    end
end)

-- Kullanıcı tableti kapattığında
RegisterNetEvent('qb-hackingtablet:server:tabletClosed')
AddEventHandler('qb-hackingtablet:server:tabletClosed', function()
    local src = source
    activeUsers[src] = nil
    TriggerClientEvent('qb-hackingtablet:client:updateActiveUsers', -1, activeUsers)
end)

-- Oyuncu çıktığında firewall durumunu temizle
AddEventHandler('playerDropped', function()
    local src = source
    if activeUsers[src] then
        activeUsers[src] = nil
        playerFirewalls[src] = nil -- Firewall durumunu da temizle
        TriggerClientEvent('qb-hackingtablet:client:updateActiveUsers', -1, activeUsers)
    end
end)

-- Mevcut kodun içine ekleyin
RegisterNetEvent('qb-hackingtablet:server:locatePlayer')
AddEventHandler('qb-hackingtablet:server:locatePlayer', function(targetIP)
    local src = source
    local found = false
    
    -- Önce kendi IP'sini arıyor mu kontrol et
    if activeUsers[src] and activeUsers[src].ip == targetIP then
        TriggerClientEvent('qb-hackingtablet:client:selfLocate', src)
        return
    end
    
    -- Diğer oyuncuları ara
    for id, user in pairs(activeUsers) do
        if user.ip == targetIP then
            -- Firewall kontrolü
            if playerFirewalls[id] and playerFirewalls[id].active then
                TriggerClientEvent('qb-hackingtablet:client:locateError', src, {
                    ip = targetIP,
                    message = "Erişim reddedildi! Hedef güvenlik duvarı tarafından korunuyor."
                })
                return
            end
            
            local targetPlayer = QBCore.Functions.GetPlayer(id)
            if targetPlayer then
                local targetPed = GetPlayerPed(id)
                local coords = GetEntityCoords(targetPed)
                
                TriggerClientEvent('qb-hackingtablet:client:receiveLocation', src, coords, targetIP)
                found = true
                break
            end
        end
    end
    
    if not found then
        TriggerClientEvent('qb-hackingtablet:client:locateError', src, {
            ip = targetIP,
            message = "IP adresi bulunamadı veya hedef çevrimdışı."
        })
    end
end)

-- Mevcut kodların altına ekleyin
QBCore.Functions.CreateCallback('qb-hackingtablet:server:getCitizensData', function(source, cb)
    local citizens = {}
    
    exports.oxmysql:query('SELECT citizenid, charinfo, metadata FROM players', {}, function(results)
        if results then
            for _, player in pairs(results) do
                local charinfo = json.decode(player.charinfo)
                local metadata = json.decode(player.metadata)
                
                if charinfo and metadata then
                    local citizenData = {
                        firstname = charinfo.firstname or "N/A",
                        lastname = charinfo.lastname or "N/A",
                        phone = charinfo.phone or "N/A",
                        citizenid = player.citizenid,
                        injail = metadata.injail or false,
                        jailtime = metadata.jailtime or 0,
                        isOnline = false
                    }
                    
                    -- Online kontrolü
                    local onlinePlayer = QBCore.Functions.GetPlayerByCitizenId(player.citizenid)
                    if onlinePlayer then
                        citizenData.isOnline = true
                        citizenData.injail = onlinePlayer.PlayerData.metadata.injail
                        citizenData.jailtime = onlinePlayer.PlayerData.metadata.jailtime
                    end
                    
                    table.insert(citizens, citizenData)
                end
            end
        end
        
        cb(citizens)
    end)
end)

-- Server başlangıcında test sorgusu
AddEventHandler('onResourceStart', function(resourceName)
    if (GetCurrentResourceName() ~= resourceName) then
        return
    end
    
    print('QB-HackingTablet: Veritabanı bağlantısı test ediliyor...')
    
    exports.oxmysql:scalar('SELECT COUNT(*) FROM players', {}, function(count)
        if count then
            print('QB-HackingTablet: Veritabanı bağlantısı başarılı!')
        else
            print('QB-HackingTablet: Veritabanı bağlantısında sorun var!')
        end
    end)
end)

-- Yeni kullanıcı kaydı
RegisterNetEvent('qb-hackingtablet:server:registerUser')
AddEventHandler('qb-hackingtablet:server:registerUser', function(data)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    
    if not Player then return end
    
    local citizenid = Player.PlayerData.citizenid
    local hashedPassword = HashPassword(data.password) -- Şifreyi hashle
    
    -- Kullanıcı adı kontrolü
    exports.oxmysql:scalar('SELECT id FROM tablet_users WHERE username = ?', {data.username}, function(exists)
        if exists then
            TriggerClientEvent('qb-hackingtablet:client:registerResponse', src, {
                success = false,
                error = 'Bu kullanıcı adı zaten kullanılıyor!'
            })
            return
        end
        
        -- Yeni kullanıcı kaydı
        exports.oxmysql:insert('INSERT INTO tablet_users (username, password, citizenid) VALUES (?, ?, ?)', 
            {data.username, hashedPassword, citizenid}, function(result)
            if result then
                TriggerClientEvent('qb-hackingtablet:client:registerResponse', src, {
                    success = true
                })
            else
                TriggerClientEvent('qb-hackingtablet:client:registerResponse', src, {
                    success = false,
                    error = 'Kayıt sırasında bir hata oluştu!'
                })
            end
        end)
    end)
end)

-- Kullanıcı girişi
RegisterNetEvent('qb-hackingtablet:server:loginUser')
AddEventHandler('qb-hackingtablet:server:loginUser', function(data)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    
    if not Player then return end
    
    exports.oxmysql:single('SELECT * FROM tablet_users WHERE username = ?', {data.username}, function(user)
        if not user then
            TriggerClientEvent('qb-hackingtablet:client:loginResponse', src, {
                success = false,
                error = 'Kullanıcı bulunamadı!'
            })
            return
        end
        
        if not VerifyPassword(data.password, user.password) then
            TriggerClientEvent('qb-hackingtablet:client:loginResponse', src, {
                success = false,
                error = 'Hatalı şifre!'
            })
            return
        end
        
        TriggerClientEvent('qb-hackingtablet:client:loginResponse', src, {
            success = true,
            username = user.username
        })
    end)
end)

-- Şifre hashleme fonksiyonu
function HashPassword(password)
    return password -- Gerçek uygulamada güvenli bir hash fonksiyonu kullanın
end

-- Şifre doğrulama fonksiyonu
function VerifyPassword(password, hashedPassword)
    return password == hashedPassword -- Gerçek uygulamada hash karşılaştırması yapın
end

-- Mesajları getir
QBCore.Functions.CreateCallback('qb-hackingtablet:server:getChatMessages', function(source, cb)
    exports.oxmysql:execute('SELECT * FROM tablet_chat_messages ORDER BY created_at DESC LIMIT 100', {}, function(messages)
        cb(messages)
    end)
end)

-- SendChatMessage eventini güncelle
RegisterNetEvent('qb-hackingtablet:server:sendChatMessage')
AddEventHandler('qb-hackingtablet:server:sendChatMessage', function(data)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    local roomCode = data.roomCode
    local message = data.message
    
    if ChatRooms[roomCode] then
        exports.oxmysql:scalar('SELECT username FROM tablet_users WHERE citizenid = ?', 
        {Player.PlayerData.citizenid}, function(username)
            if username then
                -- Mesaj tipine göre içeriği ayarla
                local messageContent = json.encode(message) -- Tüm mesaj objesini JSON olarak sakla
                
                exports.oxmysql:insert('INSERT INTO tablet_chat_messages (sender_citizenid, sender_username, room_code, message) VALUES (?, ?, ?, ?)',
                {
                    Player.PlayerData.citizenid,
                    username,
                    roomCode,
                    messageContent
                }, function(messageId)
                    if messageId then
                        local messageData = {
                            id = messageId,
                            sender = Player.PlayerData.citizenid,
                            sender_name = username,
                            content = message,
                            timestamp = os.time()
                        }
                        
                        table.insert(ChatRooms[roomCode].messages, messageData)
                        
                        for memberSrc, memberData in pairs(ChatRooms[roomCode].members) do
                            local targetSrc = tonumber(memberSrc)
                            if targetSrc then
                                TriggerClientEvent('qb-hackingtablet:client:receiveChatMessage', targetSrc, {
                                    roomCode = roomCode,
                                    message = messageData
                                })
                            end
                        end
                    end
                end)
            end
        end)
    end
end)

-- Oda mesajlarını getir
QBCore.Functions.CreateCallback('qb-hackingtablet:server:getRoomMessages', function(source, cb, roomCode)
    exports.oxmysql:execute('SELECT * FROM tablet_chat_messages WHERE room_code = ? ORDER BY created_at ASC', {roomCode}, 
    function(messages)
        cb(messages or {})
    end)
end)

-- Mail gönderme
RegisterNetEvent('qb-hackingtablet:server:sendMail')
AddEventHandler('qb-hackingtablet:server:sendMail', function(data)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    
    if not Player then 
        TriggerClientEvent('qb-hackingtablet:client:mailResponse', src, {
            success = false,
            error = 'Oyuncu bulunamadı!'
        })
        return 
    end

    -- Gönderici ve alıcı kontrolü
    if not data.sender or not data.receiver or not data.subject or not data.content then
        TriggerClientEvent('qb-hackingtablet:client:mailResponse', src, {
            success = false,
            error = 'Eksik bilgi!'
        })
        return
    end

    -- Alıcı kontrolü
    exports.oxmysql:scalar('SELECT username FROM tablet_users WHERE username = ?', {data.receiver}, 
    function(receiverExists)
        if not receiverExists then
            TriggerClientEvent('qb-hackingtablet:client:mailResponse', src, {
                success = false,
                error = 'Alıcı bulunamadı!'
            })
            return
        end
        
        -- Mail verilerini hazırla
        local mailData = {
            sender_username = data.sender,
            receiver_username = data.receiver,
            subject = data.subject,
            content = data.content,
            is_read = 0,
            is_delivered = 1, -- Varsayılan olarak iletildi kabul ediyoruz
            delivered_at = os.date('%Y-%m-%d %H:%M:%S')
        }
        
        -- Maili kaydet
        exports.oxmysql:insert('INSERT INTO tablet_mails (sender_username, receiver_username, subject, content, is_read, is_delivered, delivered_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        {
            mailData.sender_username,
            mailData.receiver_username,
            mailData.subject,
            mailData.content,
            mailData.is_read,
            mailData.is_delivered,
            mailData.delivered_at
        }, function(mailId)
            if mailId then
                -- Gönderici için başarılı mesajı
                TriggerClientEvent('qb-hackingtablet:client:mailResponse', src, {
                    success = true,
                    message = 'Mail başarıyla gönderildi!'
                })
                
                -- Alıcıya bildirim gönder
                local Players = QBCore.Functions.GetPlayers()
                for _, playerId in ipairs(Players) do
                    local TargetPlayer = QBCore.Functions.GetPlayer(playerId)
                    if TargetPlayer then
                        exports.oxmysql:scalar('SELECT username FROM tablet_users WHERE citizenid = ?', 
                        {TargetPlayer.PlayerData.citizenid}, function(username)
                            if username == data.receiver then
                                TriggerClientEvent('qb-hackingtablet:client:newMailNotification', playerId, {
                                    sender = data.sender,
                                    subject = data.subject
                                })
                            end
                        end)
                    end
                end
            else
                TriggerClientEvent('qb-hackingtablet:client:mailResponse', src, {
                    success = false,
                    error = 'Mail gönderilirken bir hata oluştu!'
                })
            end
        end)
    end)
end)

-- Mail silme
RegisterNetEvent('qb-hackingtablet:deleteMail')
AddEventHandler('qb-hackingtablet:deleteMail', function(data)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    
    if not Player then 
        TriggerClientEvent('qb-hackingtablet:deleteMailResponse', src, {
            status = "error",
            message = "Oyuncu bulunamadı"
        })
        return 
    end
    
    if not data or not data.mailId then
        TriggerClientEvent('qb-hackingtablet:deleteMailResponse', src, {
            status = "error",
            message = "Geçersiz mail ID"
        })
        return
    end
    
    -- Önce kullanıcının username'ini al
    exports.oxmysql:scalar('SELECT username FROM tablet_users WHERE citizenid = ?', 
    {Player.PlayerData.citizenid}, function(username)
        if username then
            -- Kullanıcının maili silme yetkisi var mı kontrol et
            exports.oxmysql:single('SELECT is_deleted_for FROM tablet_mails WHERE id = ?', {data.mailId}, 
            function(result)
                if result then
                    local isDeletedFor = result.is_deleted_for or ""
                    local updatedDeletedFor = isDeletedFor == "" and username or isDeletedFor .. "," .. username
                    
                    -- Silinen mailin kaydını tut
                    exports.oxmysql:execute('UPDATE tablet_mails SET is_deleted_for = ? WHERE id = ?', 
                    {updatedDeletedFor, data.mailId}, 
                    function(affectedRows)
                        -- Başarılı yanıt gönder
                        TriggerClientEvent('qb-hackingtablet:deleteMailResponse', src, {
                            status = "success",
                            mailId = data.mailId
                        })
                    end)
                else
                    TriggerClientEvent('qb-hackingtablet:deleteMailResponse', src, {
                        status = "error",
                        message = "Mail bulunamadı"
                    })
                end
            end)
        else
            TriggerClientEvent('qb-hackingtablet:deleteMailResponse', src, {
                status = "error",
                message = "Kullanıcı bulunamadı"
            })
        end
    end)
end)

-- Callback'leri kaydet
QBCore.Functions.CreateCallback('qb-hackingtablet:server:getMails', function(source, cb)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    
    if not Player then 
        cb({})
        return 
    end
    
    exports.oxmysql:scalar('SELECT username FROM tablet_users WHERE citizenid = ?', 
    {Player.PlayerData.citizenid}, function(username)
        if username then
            exports.oxmysql:execute([[
                SELECT * FROM tablet_mails 
                WHERE (sender_username = ? OR receiver_username = ?)
                AND (is_deleted_for IS NULL OR is_deleted_for NOT LIKE CONCAT('%', ?, '%'))
                ORDER BY created_at DESC
            ]], {username, username, username}, function(mails)
                cb(mails or {})
            end)
        else
            cb({})
        end
    end)
end)

QBCore.Functions.CreateCallback('qb-hackingtablet:server:getUsername', function(source, cb)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    
    if not Player then 
        cb(nil)
        return 
    end
    
    exports.oxmysql:scalar('SELECT username FROM tablet_users WHERE citizenid = ?', 
    {Player.PlayerData.citizenid}, function(username)
        cb(username)
    end)
end)

-- Firewall durumu güncelleme
RegisterNetEvent('qb-hackingtablet:server:updateFirewallStatus')
AddEventHandler('qb-hackingtablet:server:updateFirewallStatus', function(data)
    local src = source
    playerFirewalls[src] = data
end)

-- Mail okundu olarak işaretleme
RegisterNetEvent('qb-hackingtablet:server:markMailAsRead')
AddEventHandler('qb-hackingtablet:server:markMailAsRead', function(mailId)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    
    if not Player then return end
    
    exports.oxmysql:scalar('SELECT username FROM tablet_users WHERE citizenid = ?', 
    {Player.PlayerData.citizenid}, function(username)
        if username then
            -- Maili güncelle
            exports.oxmysql:execute('UPDATE tablet_mails SET is_read = 1, read_at = NOW() WHERE id = ? AND receiver_username = ?', 
            {mailId, username}, function()
                -- Göndericiyi bilgilendir
                exports.oxmysql:single('SELECT sender_username FROM tablet_mails WHERE id = ?', {mailId}, 
                function(result)
                    if result and result.sender_username then
                        -- Tüm oyuncularda göndericiyi bul
                        local Players = QBCore.Functions.GetPlayers()
                        for _, playerId in ipairs(Players) do
                            local TargetPlayer = QBCore.Functions.GetPlayer(playerId)
                            if TargetPlayer then
                                exports.oxmysql:scalar('SELECT username FROM tablet_users WHERE citizenid = ?', 
                                {TargetPlayer.PlayerData.citizenid}, function(senderUsername)
                                    if senderUsername == result.sender_username then
                                        -- Göndericiyi bilgilendir
                                        TriggerClientEvent('qb-hackingtablet:client:mailReadUpdate', playerId, {
                                            mailId = mailId,
                                            readAt = os.date('%Y-%m-%d %H:%M:%S')
                                        })
                                    end
                                end)
                            end
                        end
                    end
                end)
            end)
        end
    end)
end)

-- Görsel yükleme için yeni event
RegisterNetEvent('qb-hackingtablet:server:uploadImage')
AddEventHandler('qb-hackingtablet:server:uploadImage', function(imageData)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    
    if not Player then return end
    
    -- Base64 görselini kaydet
    local fileName = "mail_image_" .. os.time() .. "_" .. math.random(1000, 9999) .. ".jpg"
    local filePath = GetResourcePath(GetCurrentResourceName()) .. "/uploads/" .. fileName
    
    -- Dizin kontrolü
    local uploadsDir = GetResourcePath(GetCurrentResourceName()) .. "/uploads/"
    if not os.rename(uploadsDir, uploadsDir) then
        os.execute("mkdir " .. uploadsDir)
    end
    
    -- Görseli kaydet
    local file = io.open(filePath, "wb")
    if file then
        file:write(imageData)
        file:close()
        
        -- URL'i istemciye gönder
        TriggerClientEvent('qb-hackingtablet:client:imageUploaded', src, {
            success = true,
            url = "nui://" .. GetCurrentResourceName() .. "/uploads/" .. fileName
        })
    else
        TriggerClientEvent('qb-hackingtablet:client:imageUploaded', src, {
            success = false,
            error = "Görsel kaydedilemedi!"
        })
    end
end)

-- Envanter öğelerini getiren callback
QBCore.Functions.CreateCallback('qb-hackingtablet:server:getInventoryItems', function(source, cb)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    
    if not Player then 
        cb({})
        return 
    end
    
    local items = {}
    local inventory = Player.PlayerData.items
    
    for _, item in pairs(inventory) do
        if item.amount > 0 then
            table.insert(items, {
                name = item.name,
                label = item.label,
                amount = item.amount,
                image = item.image or item.name .. ".png" -- Varsayılan görsel adı
            })
        end
    end
    
    cb(items)
end)

-- Mağaza ürünleri tablosunu oluştur
CreateThread(function()
    local createStoreTableQuery = [[
        CREATE TABLE IF NOT EXISTS `tablet_store_listings` (
            `id` int(11) NOT NULL AUTO_INCREMENT,
            `seller_username` varchar(50) NOT NULL,
            `item_name` varchar(50) NOT NULL,
            `item_label` varchar(50) NOT NULL,
            `amount` int(11) NOT NULL,
            `price` int(11) NOT NULL,
            `store_link` varchar(50) NOT NULL,
            `image` varchar(50) NOT NULL,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `store_link` (`store_link`)
        )
    ]]

    exports.oxmysql:execute(createStoreTableQuery)
end)

-- Yeni ürün ekleme
RegisterNetEvent('qb-hackingtablet:server:createStoreListing')
AddEventHandler('qb-hackingtablet:server:createStoreListing', function(data)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    
    if not Player then return end
    
    -- Kullanıcı adını al
    exports.oxmysql:scalar('SELECT username FROM tablet_users WHERE citizenid = ?', 
    {Player.PlayerData.citizenid}, function(username)
        if username then
            -- Ürünü veritabanına ekle
            exports.oxmysql:insert('INSERT INTO tablet_store_listings (seller_username, item_name, item_label, amount, price, store_link, image) VALUES (?, ?, ?, ?, ?, ?, ?)',
            {
                username,
                data.name,
                data.label,
                data.amount,
                data.price,
                data.storeLink,
                data.image
            }, function(listingId)
                if listingId then
                    -- Başarılı yanıt gönder
                    TriggerClientEvent('qb-hackingtablet:client:listingCreated', src, {
                        success = true,
                        storeLink = data.storeLink
                    })
                    
                    -- Tüm kullanıcılara yeni listeyi gönder
                    TriggerClientEvent('qb-hackingtablet:client:updateListings', -1)
                end
            end)
        end
    end)
end)

-- Ürün silme
RegisterNetEvent('qb-hackingtablet:server:deleteStoreListing')
AddEventHandler('qb-hackingtablet:server:deleteStoreListing', function(storeLink)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    
    if not Player then return end
    
    -- Kullanıcı adını al
    exports.oxmysql:scalar('SELECT username FROM tablet_users WHERE citizenid = ?', 
    {Player.PlayerData.citizenid}, function(username)
        if username then
            -- Ürünün sahibi mi kontrol et
            exports.oxmysql:execute('DELETE FROM tablet_store_listings WHERE store_link = ? AND seller_username = ?',
            {storeLink, username}, function(affectedRows)
                if affectedRows > 0 then
                    -- Başarılı yanıt gönder
                    TriggerClientEvent('qb-hackingtablet:client:listingDeleted', src, {
                        success = true,
                        message = 'Ürün başarıyla silindi!'
                    })
                    
                    -- Tüm kullanıcılara güncel listeyi gönder
                    TriggerClientEvent('qb-hackingtablet:client:updateListings', -1)
                else
                    TriggerClientEvent('qb-hackingtablet:client:listingDeleted', src, {
                        success = false,
                        message = 'Bu ürünü silme yetkiniz yok!'
                    })
                end
            end)
        end
    end)
end)

-- Mağaza listesini getir
QBCore.Functions.CreateCallback('qb-hackingtablet:server:getStoreListings', function(source, cb)
    exports.oxmysql:execute('SELECT * FROM tablet_store_listings ORDER BY created_at DESC', {}, function(listings)
        cb(listings or {})
    end)
end)

-- Oda oluşturma
RegisterNetEvent('qb-hackingtablet:server:createChatRoom')
AddEventHandler('qb-hackingtablet:server:createChatRoom', function(roomCode)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    
    if not ChatRooms[roomCode] then
        ChatRooms[roomCode] = {
            owner = Player.PlayerData.citizenid,
            messages = {},
            members = {},
            created_at = os.time()
        }
        print('Yeni oda oluşturuldu:', roomCode)
    end
end)

-- Odaya katılma
QBCore.Functions.CreateCallback('qb-hackingtablet:server:joinChatRoom', function(source, cb, roomCode)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    
    if not ChatRooms[roomCode] then
        ChatRooms[roomCode] = {
            owner = Player.PlayerData.citizenid,
            messages = {},
            members = {},
            created_at = os.time()
        }
    end
    
    -- Odaya katıl
    if not ChatRooms[roomCode].members then
        ChatRooms[roomCode].members = {}
    end
    
    -- Üyeyi ekle
    ChatRooms[roomCode].members[tostring(src)] = {
        citizenid = Player.PlayerData.citizenid,
        name = Player.PlayerData.charinfo.firstname
    }
    
    print('Odaya katılım:', json.encode({
        roomCode = roomCode,
        src = src,
        members = ChatRooms[roomCode].members
    }))
    
    -- Başarılı yanıt gönder
    cb({
        success = true,
        messages = ChatRooms[roomCode].messages or {},
        members = ChatRooms[roomCode].members
    })
end)

-- Odadan ayrılma
RegisterNetEvent('qb-hackingtablet:server:leaveChatRoom')
AddEventHandler('qb-hackingtablet:server:leaveChatRoom', function(roomCode)
    local src = source
    if ChatRooms[roomCode] and ChatRooms[roomCode].members then
        ChatRooms[roomCode].members[tostring(src)] = nil
    end
end)
