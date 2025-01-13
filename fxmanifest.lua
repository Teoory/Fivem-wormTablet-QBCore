fx_version 'cerulean'
game 'gta5'

description 'QB-HackingTablet'
version '1.0.0'

ui_page 'html/index.html'

shared_scripts {
    '@qb-core/shared/locale.lua',
    'config.lua'
}

client_scripts {
    'client/main.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/main.lua'
}

files {
    'html/index.html',
    'html/style.css',
    'html/script.js',
    'html/jquery.min.js',
    'html/jquery-ui.min.js'
}

lua54 'yes'

dependencies {
    'qb-core',
    'oxmysql'
}