@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

echo ============================================
echo   ISG Test Platformu - GitHub Push Araci
echo ============================================
echo.

REM --- Git kurulu mu kontrol et ---
where git >nul 2>nul
if errorlevel 1 (
    echo [HATA] Git bulunamadi. Once https://git-scm.com adresinden Git'i kurun.
    pause
    exit /b 1
)

REM --- Bu script'in bulundugu klasore gec (proje kok klasoru) ---
cd /d "%~dp0"

REM --- Daha once git init yapilmis mi kontrol et ---
if not exist ".git" (
    echo Git deposu baslatiliyor...
    git init
    git branch -M main
) else (
    echo Mevcut git deposu bulundu, devam ediliyor...
)

REM --- .gitignore yoksa olustur (node_modules ve .env.local push'lanmasin) ---
if not exist ".gitignore" (
    echo node_modules>> .gitignore
    echo .next>> .gitignore
    echo .env.local>> .gitignore
    echo .env>> .gitignore
)

REM --- Uzak repo (remote) ayarli mi kontrol et ---
git remote get-url origin >nul 2>nul
if errorlevel 1 (
    set NEED_REMOTE=1
) else (
    echo.
    echo Mevcut remote:
    git remote get-url origin
    echo.
    set /p CHANGE_REMOTE="Bu adres dogru mu ve kullanmak istiyor musunuz? (E/h): "
    if /i "!CHANGE_REMOTE!"=="h" (
        set NEED_REMOTE=1
    ) else (
        set NEED_REMOTE=0
    )
)

:ask_remote
if "!NEED_REMOTE!"=="1" (
    echo.
    echo GitHub'da once bos bir repo olusturun ^(README eklemeden^),
    echo sonra o reponun HTTPS adresini asagiya yapistirin.
    echo Ornek: https://github.com/kullanici-adi/isg-test-platformu.git
    echo ^(Sadece profil adresini ^(https://github.com/kullanici-adi^) YAPISTIRMAYIN,
    echo  repo adini ve .git uzantisini icermelidir.^)
    echo.
    set /p REPO_URL="GitHub repo adresi: "

    REM --- Basit dogrulama: adres en az iki '/' ile ayrilmis parca icermeli (kullanici/repo) ---
    echo !REPO_URL! | findstr /r "github\.com/[^/]*\/[^/]*" >nul
    if errorlevel 1 (
        echo.
        echo [UYARI] Bu adres bir repo adresine benzemiyor ^(kullanici adi/repo adi eksik olabilir^).
        set /p RETRY="Tekrar girmek ister misiniz? (E/h): "
        if /i not "!RETRY!"=="h" goto ask_remote
    )

    git remote remove origin >nul 2>nul
    git remote add origin "!REPO_URL!"
)

echo.
set /p COMMIT_MSG="Commit mesaji (bos birakirsaniz varsayilan kullanilir): "
if "!COMMIT_MSG!"=="" set COMMIT_MSG=ISG test platformu guncellemesi

echo.
echo Degisiklikler ekleniyor...
git add .

git commit -m "!COMMIT_MSG!"
if errorlevel 1 (
    echo.
    echo Commit edilecek yeni bir degisiklik bulunamadi ^(veya ilk commit hatasi olustu^).
)

echo.
echo GitHub'a gonderiliyor...
git branch -M main
git push -u origin main

if errorlevel 1 (
    echo.
    echo [BILGI] Push reddedildi. Bunun en yaygin nedeni: GitHub'daki repo bos degil
    echo ^(orn. repo olustururken README/.gitignore/lisans eklendiyse^).
    echo.
    echo Ne yapmak istersiniz?
    echo   1 = GitHub'daki icerigi yerel projemle DEGISTIR ^(force push - GitHub'daki
    echo       dosyalar silinir, genelde yeni/bos repo icin guvenlidir^)
    echo   2 = Once GitHub'daki degisiklikleri indirip birlestirmeyi dene ^(pull^)
    echo   3 = Iptal et, kendim hallederim
    echo.
    set /p PUSH_CHOICE="Seciminiz (1/2/3): "

    if "!PUSH_CHOICE!"=="1" (
        echo.
        echo Force push yapiliyor...
        git push -u origin main --force
        if errorlevel 1 (
            echo.
            echo [HATA] Force push de basarisiz oldu. Kullanici adi/sifre yerine
            echo "Personal Access Token" gerekebilir, ya da remote adresi yanlis olabilir.
            pause
            exit /b 1
        )
    ) else if "!PUSH_CHOICE!"=="2" (
        echo.
        echo Uzak degisiklikler indiriliyor ve birlestiriliyor...
        git pull origin main --allow-unrelated-histories
        if errorlevel 1 (
            echo.
            echo [HATA] Birlestirme sirasinda cakisma olustu. Lutfen cakisan dosyalari
            echo elle duzenleyip "git add ." ve "git commit" ile tamamlayin, sonra
            echo tekrar "git push -u origin main" calistirin.
            pause
            exit /b 1
        )
        echo.
        echo Tekrar gonderiliyor...
        git push -u origin main
        if errorlevel 1 (
            echo.
            echo [HATA] Push hala basarisiz. Yukaridaki adimlari kontrol edin.
            pause
            exit /b 1
        )
    ) else (
        echo.
        echo Islem iptal edildi.
        pause
        exit /b 1
    )
)

echo.
echo ============================================
echo   Basarili! Proje GitHub'a yuklendi.
echo ============================================
pause
