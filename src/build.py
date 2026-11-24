import json, shutil, os
shell=open('shell.html').read(); eng=open('engine.js').read(); ui=open('help.js').read()+'\n'+open('ui.js').read()
scripts=f"<script>\n{eng}\n</script>\n<script>\n{ui}\n</script>\n"
open('dist/artifact.html','w').write(shell+scripts)
head_extra='''<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Gridiron GM">
<meta name="theme-color" content="#1d6a3b">
<link rel="manifest" href="manifest.json">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<script data-goatcounter="https://gridirongm.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>
'''
style_end=shell.index('</style>')+8
head=shell[:style_end]; body=shell[style_end:]
base_css="<style>html{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n"
gh=f"<!doctype html>\n<html lang=\"en\">\n<head>\n{head_extra}{head}\n{base_css}</head>\n<body>{body}{scripts}</body>\n</html>\n"
open('dist/gridiron-gm/index.html','w').write(gh)
json.dump({"name":"Gridiron GM","short_name":"Gridiron GM","start_url":"./","scope":"./","display":"standalone","background_color":"#0d1611","theme_color":"#1d6a3b",
 "icons":[{"src":"icon-192.png","sizes":"192x192","type":"image/png"},{"src":"icon-512.png","sizes":"512x512","type":"image/png"}]},open('dist/gridiron-gm/manifest.json','w'),indent=1)
shutil.copy('sw.js','dist/gridiron-gm/sw.js')
if os.path.exists('rosters.json'): shutil.copy('rosters.json', 'dist/gridiron-gm/rosters.json')
if os.path.exists('drive-src.html'):
    d=open('drive-src.html').read().replace('/*ENGINE*/', eng).replace('/*PIXELKIT*/', open('pixel-arcade-kit.js').read())
    open('dist/gridiron-gm/drive.html','w').write(d); open('dist/drive.html','w').write(d)
