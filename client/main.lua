local QBCore = exports['qb-core']:GetCoreObject()
local tabletOpen = false

-- Global değişkenler en üstte tanımlanmalı
local currentBlip = nil
local currentAreaBlip = nil

-- Tablet kullanma eventi
RegisterNetEvent('qb-hackingtablet:client:openTablet')
AddEventHandler('qb-hackingtablet:client:openTablet', function()
    local Player = QBCore.Functions.GetPlayerData()
    
    if Player.job.name == "hacker" then
        if not tabletOpen then
            tabletOpen = true
            -- Tablet animasyonu
            RequestAnimDict("amb@code_human_in_bus_passenger_idles@female@tablet@base")
            while not HasAnimDictLoaded("amb@code_human_in_bus_passenger_idles@female@tablet@base") do
                Wait(0)
            end
            TaskPlayAnim(PlayerPedId(), "amb@code_human_in_bus_passenger_idles@female@tablet@base", "base", 3.0, 3.0, -1, 49, 0, 0, 0, 0)
            -- Prop ekleme
            TriggerEvent('animations:client:CreateTabletProp')
            
            -- Sunucuya bildir
            TriggerServerEvent('qb-hackingtablet:server:tabletOpened')
            
            -- NUI'yi aç
            SetNuiFocus(true, true)
            SendNUIMessage({
                action = "openTablet"
            })
        end
    else
        QBCore.Functions.Notify('Bu cihazı kullanma yetkiniz yok!', 'error')
    end
end)

-- NUI Callback
RegisterNUICallback('closeTablet', function(data, cb)
    SetNuiFocus(false, false)
    tabletOpen = false
    
    -- Animasyon ve prop temizleme
    StopAnimTask(PlayerPedId(), "amb@code_human_in_bus_passenger_idles@female@tablet@base", "base", 1.0)
    TriggerEvent('animations:client:RemoveTabletProp')
    
    -- Sunucuya bildir
    TriggerServerEvent('qb-hackingtablet:server:tabletClosed')
    
    if cb then cb('ok') end
end)

-- Tablet prop oluşturma
RegisterNetEvent('animations:client:CreateTabletProp')
AddEventHandler('animations:client:CreateTabletProp', function()
    local tabletModel = `prop_cs_tablet`
    local playerPed = PlayerPedId()
    
    RequestModel(tabletModel)
    while not HasModelLoaded(tabletModel) do
        Wait(10)
    end
    
    local tabletObj = CreateObject(tabletModel, 0.0, 0.0, 0.0, true, true, false)
    local tabletBoneIndex = GetPedBoneIndex(playerPed, 28422)
    
    AttachEntityToEntity(tabletObj, playerPed, tabletBoneIndex, 0.12, 0.0, 0.0, 0.0, 0.0, 0.0, true, true, false, true, 1, true)
    SetModelAsNoLongerNeeded(tabletModel)
    
    tablet = tabletObj
end)

-- Tablet prop silme
RegisterNetEvent('animations:client:RemoveTabletProp')
AddEventHandler('animations:client:RemoveTabletProp', function()
    if tablet then
        DeleteEntity(tablet)
        tablet = nil
    end
end)

-- Kullanıcı bilgilerini güncelle
RegisterNetEvent('qb-hackingtablet:client:setUserInfo')
AddEventHandler('qb-hackingtablet:client:setUserInfo', function(info)
    if tabletOpen then
        SendNUIMessage({
            action = "updateUserInfo",
            info = info
        })
    end
end)

-- Aktif kullanıcıları güncelle
RegisterNetEvent('qb-hackingtablet:client:updateActiveUsers')
AddEventHandler('qb-hackingtablet:client:updateActiveUsers', function(users)
    if tabletOpen then
        SendNUIMessage({
            action = "updateActiveUsers",
            users = users
        })
    end
end)

-- Item kullanımı
CreateThread(function()
    Wait(1000)
    TriggerEvent('QBCore:Client:UpdateObject')
end)

-- Diğer RegisterNUICallback'lerin yanına ekleyin
RegisterNUICallback('locatePlayer', function(data, cb)
    TriggerServerEvent('qb-hackingtablet:server:locatePlayer', data.ip)
    if cb then cb('ok') end
end)

-- Mevcut kodun içine ekleyin
RegisterNetEvent('qb-hackingtablet:client:selfLocate', function()
    if tabletOpen then
        -- Ekrana titreşim efekti
        ShakeGameplayCam('SMALL_EXPLOSION_SHAKE', 0.2)
        
        -- Terminal'e uyarı mesajı gönder
        SendNUIMessage({
            action = "locateWarning",
            message = "UYARI: Konuma çok yakınsın! Sinyal çok güçlü!\nGüvenlik sebebiyle konum işaretleme iptal edildi.\n\n"
        })
        
        -- Ekrana kırmızı flaş efekti
        AnimpostfxPlay('FocusIn', 0, false)
        Wait(1000)
        AnimpostfxStop('FocusIn')
    end
end)

-- receiveLocation eventini güncelle
RegisterNetEvent('qb-hackingtablet:client:receiveLocation', function(coords, ip)
    -- Ses efekti ekle
    PlaySoundFrontend(-1, "ATM_WINDOW", "HUD_FRONTEND_DEFAULT_SOUNDSET", 1)
    
    -- Haritada blip oluştur
    local blip = AddBlipForCoord(coords.x, coords.y, coords.z)
    SetBlipSprite(blip, 459)
    SetBlipColour(blip, 1)
    SetBlipScale(blip, 1.0)
    SetBlipAsShortRange(blip, false)
    BeginTextCommandSetBlipName("STRING")
    AddTextComponentString("Hedef IP: " .. ip)
    EndTextCommandSetBlipName(blip)
    
    -- Terminal'e bilgi gönder
    if tabletOpen then
        SendNUIMessage({
            action = "locateSuccess",
            message = "IP Adresi bulundu: " .. ip .. "\nKonum haritada işaretlendi."
        })
    end
    
    -- 30 saniye sonra blip'i kaldır
    SetTimeout(30000, function()
        RemoveBlip(blip)
        if tabletOpen then
            SendNUIMessage({
                action = "locateTimeout",
                message = "Konum işareti zaman aşımına uğradı."
            })
        end
    end)
end)

-- NUI Callbacks kısmına ekleyin
RegisterNUICallback('getCitizensData', function(data, cb)
    QBCore.Functions.TriggerCallback('qb-hackingtablet:server:getCitizensData', function(citizens)
        cb(citizens)
    end)
end)

-- locateError eventini güncelle
RegisterNetEvent('qb-hackingtablet:client:locateError', function(data)
    if tabletOpen then
        SendNUIMessage({
            action = "locateError",
            message = data.message
        })
        
        -- Hata sesi çal
        PlaySoundFrontend(-1, "Hack_Failed", "DLC_HEIST_BIOLAB_PREP_HACKING_SOUNDS", 1)
        
        -- Terminal ekranında kırmızı yanıp sönme efekti
        AnimpostfxPlay('FocusIn', 0, false)
        Wait(500)
        AnimpostfxStop('FocusIn')
    end
end)

-- Register callback
RegisterNUICallback('registerUser', function(data, cb)
    TriggerServerEvent('qb-hackingtablet:server:registerUser', data)
    cb('ok')
end)

-- Login callback
RegisterNUICallback('loginUser', function(data, cb)
    TriggerServerEvent('qb-hackingtablet:server:loginUser', data)
    cb('ok')
end)

-- Register response
RegisterNetEvent('qb-hackingtablet:client:registerResponse')
AddEventHandler('qb-hackingtablet:client:registerResponse', function(response)
    SendNUIMessage({
        action = "registerResponse",
        data = response
    })
end)

-- Login response
RegisterNetEvent('qb-hackingtablet:client:loginResponse')
AddEventHandler('qb-hackingtablet:client:loginResponse', function(response)
    SendNUIMessage({
        action = "loginResponse",
        data = response
    })
end)

-- Chat mesajlarını al
RegisterNUICallback('getChatMessages', function(data, cb)
    QBCore.Functions.TriggerCallback('qb-hackingtablet:server:getChatMessages', function(messages)
        cb(messages)
    end)
end)

-- Yeni mesaj gönder
RegisterNUICallback('sendChatMessage', function(data, cb)
    if data.message then
        TriggerServerEvent('qb-hackingtablet:server:sendChatMessage', data.message)
    end
    cb('ok')
end)

-- Yeni mesaj al
RegisterNetEvent('qb-hackingtablet:client:receiveChatMessage')
AddEventHandler('qb-hackingtablet:client:receiveChatMessage', function(data)
    print('Mesaj alındı:', json.encode(data))
    SendNUIMessage({
        action = "newChatMessage",
        data = data
    })
end)

-- Mail işlemleri
RegisterNUICallback('getMails', function(data, cb)
    QBCore.Functions.TriggerCallback('qb-hackingtablet:server:getMails', function(mails)
        cb(mails)
    end)
end)

RegisterNUICallback('sendMail', function(data, cb)
    TriggerServerEvent('qb-hackingtablet:server:sendMail', data)
    cb('ok')
end)

RegisterNUICallback('markMailAsRead', function(data, cb)
    TriggerServerEvent('qb-hackingtablet:server:markMailAsRead', data.mailId)
    cb('ok')
end)

-- Mail response
RegisterNetEvent('qb-hackingtablet:client:mailResponse')
AddEventHandler('qb-hackingtablet:client:mailResponse', function(response)
    SendNUIMessage({
        action = "mailResponse",
        data = response
    })
end)

-- Yeni mail bildirimi
RegisterNetEvent('qb-hackingtablet:client:newMailNotification')
AddEventHandler('qb-hackingtablet:client:newMailNotification', function(mailData)
    SendNUIMessage({
        action = "newMailNotification",
        data = mailData
    })
end)

-- Mail silme eventi
RegisterNetEvent('qb-hackingtablet:deleteMailResponse')
AddEventHandler('qb-hackingtablet:deleteMailResponse', function(response)
    SendNUIMessage({
        type = "deleteMailResponse",
        status = response.status,
        mailId = response.mailId,
        message = response.message
    })
end)

-- NUI Callback
RegisterNUICallback('qb-hackingtablet:deleteMail', function(data, cb)
    TriggerServerEvent('qb-hackingtablet:deleteMail', data)
    cb('ok')
end)

-- Firewall durumu
local firewallActive = false

-- NUI Callback
RegisterNUICallback('updateFirewallStatus', function(data, cb)
    firewallActive = data.active
    
    -- Sunucuya bildir
    TriggerServerEvent('qb-hackingtablet:server:updateFirewallStatus', {
        active = firewallActive
    })
    
    if cb then cb('ok') end
end)

-- Hata sesi için yeni NUI Callback ekle
RegisterNUICallback('playErrorSound', function(data, cb)
    PlaySoundFrontend(-1, "Hack_Failed", "DLC_HEIST_BIOLAB_PREP_HACKING_SOUNDS", 1)
    if cb then cb('ok') end
end)

-- Envanter öğelerini getir
RegisterNUICallback('getInventoryItems', function(data, cb)
    QBCore.Functions.TriggerCallback('qb-hackingtablet:server:getInventoryItems', function(items)
        cb(items)
    end)
end)

-- Store listing callbacks
RegisterNUICallback('createStoreListing', function(data, cb)
    TriggerServerEvent('qb-hackingtablet:server:createStoreListing', data)
    cb('ok')
end)

RegisterNUICallback('getStoreListings', function(data, cb)
    QBCore.Functions.TriggerCallback('qb-hackingtablet:server:getStoreListings', function(listings)
        cb(listings)
    end)
end)

RegisterNUICallback('deleteStoreListing', function(data, cb)
    TriggerServerEvent('qb-hackingtablet:server:deleteStoreListing', data.storeLink)
    cb('ok')
end)

-- Store listing responses
RegisterNetEvent('qb-hackingtablet:client:listingCreated')
AddEventHandler('qb-hackingtablet:client:listingCreated', function(response)
    SendNUIMessage({
        action = "listingCreated",
        data = response
    })
end)

RegisterNetEvent('qb-hackingtablet:client:listingDeleted')
AddEventHandler('qb-hackingtablet:client:listingDeleted', function(response)
    SendNUIMessage({
        action = "listingDeleted",
        data = response
    })
end)

RegisterNetEvent('qb-hackingtablet:client:updateListings')
AddEventHandler('qb-hackingtablet:client:updateListings', function()
    SendNUIMessage({
        action = "updateListings"
    })
end)

-- NChat eventleri
RegisterNUICallback('joinChatRoom', function(data, cb)
    QBCore.Functions.TriggerCallback('qb-hackingtablet:server:joinChatRoom', function(response)
        cb(response)
    end, data.roomCode)
end)

RegisterNUICallback('createChatRoom', function(data, cb)
    TriggerServerEvent('qb-hackingtablet:server:createChatRoom', data.roomCode)
    cb('ok')
end)

RegisterNUICallback('sendNChatMessage', function(data, cb)
    TriggerServerEvent('qb-hackingtablet:server:sendChatMessage', data)
    cb('ok')
end)

RegisterNUICallback('leaveChatRoom', function(data, cb)
    TriggerServerEvent('qb-hackingtablet:server:leaveChatRoom', data.roomCode)
    cb('ok')
end)

RegisterNetEvent('qb-hackingtablet:client:receiveChatMessage')
AddEventHandler('qb-hackingtablet:client:receiveChatMessage', function(data)
    print('Mesaj alındı:', json.encode(data))
    SendNUIMessage({
        action = "newChatMessage",
        data = data
    })
end)

RegisterNUICallback('markLocation', function(data, cb)
    print('markLocation çağrıldı:', json.encode(data)) -- Debug için
    
    local coords = vector3(data.coords.x, data.coords.y, data.coords.z)
    
    if data.type == 'exact' then
        -- Önceki blip'i temizle
        if currentBlip ~= nil then
            RemoveBlip(currentBlip)
            currentBlip = nil
        end
        
        -- Yeni blip oluştur
        currentBlip = AddBlipForCoord(coords.x, coords.y, coords.z)
        SetBlipSprite(currentBlip, 162)
        SetBlipColour(currentBlip, 3)
        SetBlipScale(currentBlip, 1.5)
        SetBlipAsShortRange(currentBlip, false)
        BeginTextCommandSetBlipName("STRING")
        AddTextComponentString("Paylaşılan Konum")
        EndTextCommandSetBlipName(currentBlip)
        
        -- GPS'i ayarla
        SetNewWaypoint(coords.x, coords.y)
        
    elseif data.type == 'area' then
        -- Önceki blip'leri temizle
        if currentBlip ~= nil then
            RemoveBlip(currentBlip)
            currentBlip = nil
        end
        if currentAreaBlip ~= nil then
            RemoveBlip(currentAreaBlip)
            currentAreaBlip = nil
        end
        
        -- Alan blip'i oluştur (büyük turuncu daire)
        currentAreaBlip = AddBlipForRadius(coords.x, coords.y, coords.z, 200.0)
        SetBlipRotation(currentAreaBlip, 0)
        SetBlipColour(currentAreaBlip, 2) -- yeşil renk
        SetBlipAlpha(currentAreaBlip, 200) -- Yarı saydam
        
        -- Merkez nokta blip'i
        currentBlip = AddBlipForCoord(coords.x, coords.y, coords.z)
        SetBlipSprite(currentBlip, 162)
        SetBlipColour(currentBlip, 47) -- Turuncu renk
        SetBlipScale(currentBlip, 1.5)
        SetBlipAsShortRange(currentBlip, false)
        BeginTextCommandSetBlipName("STRING")
        AddTextComponentString("Paylaşılan Alan")
        EndTextCommandSetBlipName(currentBlip)
        
        -- GPS'i ayarla
        SetNewWaypoint(coords.x, coords.y)
    end
    
    -- 30 saniye sonra blip'leri kaldır
    Citizen.SetTimeout(60000, function()
        if currentBlip ~= nil then
            RemoveBlip(currentBlip)
            currentBlip = nil
        end
        if currentAreaBlip ~= nil then
            RemoveBlip(currentAreaBlip)
            currentAreaBlip = nil
        end
    end)
    
    cb('ok')
end)

-- Oyuncunun konumunu alma
RegisterNUICallback('getPlayerLocation', function(data, cb)
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    
    cb({
        x = coords.x,
        y = coords.y,
        z = coords.z
    })
end)

-- Global değişkenler ekle
currentBlip = nil
currentAreaBlip = nil

-- Ses efekti için callback ekle
RegisterNUICallback('playSound', function(data, cb)
    if data.sound and data.soundset then
        PlaySoundFrontend(-1, data.sound, data.soundset, 1)
    end
    cb('ok')
end)