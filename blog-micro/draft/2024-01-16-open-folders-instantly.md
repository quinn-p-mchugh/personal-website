---
title: "Open Folders Instantly: Use AutoHotKey to quickly open folders in Visual Studio Code"
slug: open-folders-instantly
#description: 
keywords: ["open folder with shortuct", "open folder with hotstring", "open folder with hotkey", "open folder auto hot key", "open folder ahk", "open folder visual studio code", "open folder vs code"]
tags: []
authors: qmchugh
#image: 
hide_table_of_contents: true
draft: true
---

```ahk
; Open folder in Visual Studio Code
open_vs_code(folderPath) {
    EnvGet, local_app_data, LOCALAPPDATA
    command := """" . local_app_data . "\Programs\Microsoft VS Code\Code.exe" . """ """ . folderPath . """"
    Run, % command
}

; Open Auto Hot Key scripts folder
::/ahk::
    EnvGet, user_profile, USERPROFILE
    open_vs_code(user_profile . "\path\to\AutoHotKey\")
return

; Open Espanso configuration folder
::/espanso::
    EnvGet, user_profile, USERPROFILE
    open_vs_code(user_profile . "\path\to\Espanso\match\")
return

; Open personal website/blog
::/website::
    open_vs_code("C:\path\to\personal-website\")
return

; Open personal website/blog
::/blog::
    open_vs_code("C:\path\to\blog\")
return
```