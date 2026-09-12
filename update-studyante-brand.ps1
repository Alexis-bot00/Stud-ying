$ErrorActionPreference = "Stop"

$root = Get-Location
$docs = Join-Path $root "docs"

$indexFile = Join-Path $docs "index.html"
$loginFile = Join-Path $docs "login.html"
$styleFile = Join-Path $docs "style.css"
$loginStyleFile = Join-Path $docs "login.css"

$assetsFolder = Join-Path $docs "assets"

$sourceLogo = Join-Path $root "studyante-logo.png"
$targetLogo = Join-Path $assetsFolder "studyante-logo.png"

# CHECK FILES

if (!(Test-Path $indexFile)) {
    Write-Host "ERROR: docs/index.html not found." -ForegroundColor Red
    exit
}

if (!(Test-Path $loginFile)) {
    Write-Host "ERROR: docs/login.html not found." -ForegroundColor Red
    exit
}

if (!(Test-Path $sourceLogo)) {
    Write-Host ""
    Write-Host "ERROR: studyante-logo.png not found." -ForegroundColor Red
    Write-Host ""
    Write-Host "Put your STUDYante logo here:"
    Write-Host $root
    Write-Host ""
    exit
}

# CREATE ASSETS FOLDER

New-Item `
    -ItemType Directory `
    -Force `
    -Path $assetsFolder |
    Out-Null

# COPY LOGO

Copy-Item `
    $sourceLogo `
    $targetLogo `
    -Force

Write-Host "Logo copied to docs/assets/" -ForegroundColor Green


# ============================================================
# FUNCTION: UPDATE HTML
# ============================================================

function Update-StudYanteHTML {

    param(
        [string]$File
    )

    $html = Get-Content $File -Raw


    # --------------------------------------------------------
    # REPLACE COMMON STUDYING LOGOS
    # --------------------------------------------------------

    $logoHTML = @'
<div class="studyante-brand">
    <img
        src="assets/studyante-logo.png"
        alt="STUDYante"
        class="studyante-logo"
    >
</div>
'@

    # Studying using spans

    $html = $html -replace `
        '<[^>]*class=["''][^"'']*(?:brand|logo)[^"'']*["''][^>]*>\s*<span[^>]*>Study</span>\s*<span[^>]*>ing</span>\s*</[^>]+>', `
        $logoHTML


    # Plain Studying inside common brand element

    $html = $html -replace `
        '<(div|a|h1|h2)[^>]*class=["''][^"'']*(?:brand|logo)[^"'']*["''][^>]*>\s*Studying\s*</\1>', `
        $logoHTML


    # --------------------------------------------------------
    # ADD BRAND SCRIPT
    # This catches the logo if the HTML structure is different.
    # --------------------------------------------------------

    if (
        $html -notmatch 'studyante-brand-fix'
    ) {

$brandScript = @'

<script id="studyante-brand-fix">
document.addEventListener("DOMContentLoaded", function () {

    const selectors = [
        ".brand",
        ".logo",
        ".brand-name",
        ".sidebar-brand",
        ".sidebar-logo",
        ".navbar-brand",
        ".app-brand",
        ".login-brand",
        ".auth-brand"
    ];

    function cleanText(element) {
        return (element.textContent || "")
            .replace(/\s+/g, "")
            .toLowerCase();
    }

    let found = false;

    selectors.forEach(function (selector) {

        document
            .querySelectorAll(selector)
            .forEach(function (element) {

                if (found) {
                    return;
                }

                const text =
                    cleanText(element);

                if (
                    text === "studying"
                ) {

                    element.innerHTML =
                        '<img src="assets/studyante-logo.png" ' +
                        'alt="STUDYante" ' +
                        'class="studyante-logo">';

                    element.classList.add(
                        "studyante-brand"
                    );

                    found = true;
                }
            });
    });


    if (!found) {

        const elements =
            document.querySelectorAll(
                "h1,h2,a,div"
            );

        elements.forEach(
            function (element) {

                if (found) {
                    return;
                }

                const text =
                    cleanText(element);

                const rect =
                    element
                        .getBoundingClientRect();

                if (
                    text === "studying" &&
                    rect.top < 180
                ) {

                    element.innerHTML =
                        '<img src="assets/studyante-logo.png" ' +
                        'alt="STUDYante" ' +
                        'class="studyante-logo">';

                    element.classList.add(
                        "studyante-brand"
                    );

                    found = true;
                }
            }
        );
    }

});
</script>

'@

        $html =
            $html.Replace(
                "</body>",
                "$brandScript`r`n</body>"
            )
    }


    # --------------------------------------------------------
    # CHANGE PAGE TITLE
    # --------------------------------------------------------

    $html =
        $html -replace `
            '<title>Studying([^<]*)</title>', `
            '<title>STUDYante$1</title>'


    # --------------------------------------------------------
    # CHANGE LOGIN ACCOUNT TEXT
    # --------------------------------------------------------

    $html =
        $html -replace `
            'your Studying account', `
            'your STUDYante account'


    # --------------------------------------------------------
    # CHANGE COPYRIGHT
    # --------------------------------------------------------

    $html =
        $html -replace `
            '© 2026 Studying', `
            '© 2026 STUDYante'


    Set-Content `
        -Path $File `
        -Value $html `
        -Encoding UTF8
}


# UPDATE BOTH PAGES

Update-StudYanteHTML $indexFile
Update-StudYanteHTML $loginFile


# ============================================================
# LOGO CSS
# ============================================================

$logoCSS = @'


/* ==========================================================
   STUDYante BRAND
   ========================================================== */

.studyante-brand {
    display: flex !important;
    align-items: center !important;

    width: auto !important;
    height: auto !important;

    max-width: 100% !important;

    padding: 0 !important;

    overflow: visible !important;
}

.studyante-logo {
    display: block !important;

    width: auto !important;
    height: 50px !important;

    max-width: 200px !important;

    object-fit: contain !important;
    object-position: left center !important;
}


/* LOGIN PAGE */

.login-page .studyante-logo,
.auth-page .studyante-logo,
.login-container .studyante-logo {
    height: 64px !important;
    max-width: 280px !important;
}


/* SIDEBAR */

.sidebar .studyante-logo,
aside .studyante-logo {
    height: 48px !important;
    max-width: 190px !important;
}


/* TABLET */

@media (max-width: 900px) {

    .studyante-logo {
        height: 44px !important;
        max-width: 180px !important;
    }

}


/* MOBILE */

@media (max-width: 600px) {

    .studyante-logo {
        height: 40px !important;
        max-width: 160px !important;
    }

}

'@


# ============================================================
# ADD CSS TO STYLE.CSS
# ============================================================

if (Test-Path $styleFile) {

    $currentCSS =
        Get-Content `
            $styleFile `
            -Raw

    if (
        $currentCSS -notmatch
        "STUDYante BRAND"
    ) {

        Add-Content `
            -Path $styleFile `
            -Value $logoCSS `
            -Encoding UTF8
    }
}


# ============================================================
# ADD CSS TO LOGIN.CSS
# ============================================================

if (Test-Path $loginStyleFile) {

    $currentLoginCSS =
        Get-Content `
            $loginStyleFile `
            -Raw

    if (
        $currentLoginCSS -notmatch
        "STUDYante BRAND"
    ) {

        Add-Content `
            -Path $loginStyleFile `
            -Value $logoCSS `
            -Encoding UTF8
    }
}


# ============================================================
# FINISHED
# ============================================================

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "     STUDYante UPDATE COMPLETE" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "Updated:"
Write-Host "  docs/index.html"
Write-Host "  docs/login.html"
Write-Host "  docs/style.css"
Write-Host "  docs/login.css"
Write-Host "  docs/assets/studyante-logo.png"

Write-Host ""
Write-Host "Backend and AI were NOT changed." -ForegroundColor Yellow

Write-Host ""
Write-Host "Refresh your website with Ctrl + F5."
Write-Host ""

Write-Host "If everything looks correct:"
Write-Host ""
Write-Host "git add docs"
Write-Host 'git commit -m "Change Studying logo to STUDYante"'
Write-Host "git push"
Write-Host ""