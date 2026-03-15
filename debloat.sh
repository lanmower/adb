#!/bin/bash
ADB="${ADB:-adb}"
# If adb not in PATH, try common Windows locations
if ! command -v "$ADB" &>/dev/null; then
  for p in "/c/dev/adb/adb" "/c/platform-tools/adb" "$LOCALAPPDATA/Android/Sdk/platform-tools/adb"; do
    [ -x "$p" ] && ADB="$p" && break
    [ -x "${p}.exe" ] && ADB="${p}.exe" && break
  done
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

disabled=0
skipped=0
failed=0

log_disabled() { echo -e "${GREEN}[DISABLED]${RESET} $1"; }
log_skipped()  { echo -e "${YELLOW}[SKIPPED] ${RESET} $1"; }
log_failed()   { echo -e "${RED}[FAILED]  ${RESET} $1"; }

disable_pkg() {
  local pkg="$1"
  local exists
  exists=$("$ADB" shell pm list packages 2>/dev/null | grep -x "package:${pkg}")
  if [ -z "$exists" ]; then
    log_skipped "$pkg"
    ((skipped++))
    return
  fi
  local result
  result=$("$ADB" shell pm disable-user --user 0 "$pkg" 2>&1)
  if echo "$result" | grep -qi "disabled"; then
    log_disabled "$pkg"
    ((disabled++))
  else
    log_failed "$pkg ($result)"
    ((failed++))
  fi
}

echo -e "\n${BOLD}${CYAN}=== Android Debloat Script ===${RESET}\n"

MANUFACTURER=$("$ADB" shell getprop ro.product.manufacturer 2>/dev/null | tr '[:upper:]' '[:lower:]' | tr -d '\r')
MODEL=$("$ADB" shell getprop ro.product.model 2>/dev/null | tr -d '\r')
ANDROID=$("$ADB" shell getprop ro.build.version.release 2>/dev/null | tr -d '\r')
SERIAL=$("$ADB" get-serialno 2>/dev/null | tr -d '\r')

echo -e "${BOLD}Device:${RESET}       $MODEL"
echo -e "${BOLD}Manufacturer:${RESET} $MANUFACTURER"
echo -e "${BOLD}Android:${RESET}      $ANDROID"
echo -e "${BOLD}Serial:${RESET}       $SERIAL"
echo ""

echo -e "${BOLD}${CYAN}--- Universal Android Bloat ---${RESET}"
for pkg in \
  com.android.dreams.basic \
  com.android.dreams.phototable \
  com.android.egg \
  com.android.traceur \
  com.android.printspooler \
  com.android.hotspot2.osulogin \
  com.android.wallpaper.livepicker \
  com.android.bookmarkprovider \
  com.android.calllogbackup \
  com.android.stk
do disable_pkg "$pkg"; done

echo -e "\n${BOLD}${CYAN}--- Google Bloat ---${RESET}"
for pkg in \
  com.google.android.googlequicksearchbox \
  com.google.android.apps.googleassistant \
  com.google.android.apps.wellbeing \
  com.google.android.apps.turbo \
  com.google.android.gms.location.history \
  com.google.android.marvin.talkback \
  com.google.android.printservice.recommendation \
  com.google.android.apps.enterprise.cpanel \
  com.google.android.tts \
  com.google.android.adservices.api \
  com.google.mainline.adservices \
  com.google.android.ondevicepersonalization.services \
  com.google.android.federatedcompute \
  com.google.android.as
do disable_pkg "$pkg"; done

echo -e "\n${BOLD}${CYAN}--- Facebook ---${RESET}"
for pkg in \
  com.facebook.appmanager \
  com.facebook.services \
  com.facebook.system \
  com.facebook.katana
do disable_pkg "$pkg"; done

echo -e "\n${BOLD}${CYAN}--- TikTok ---${RESET}"
disable_pkg "com.zhiliaoapp.musically"

if echo "$MANUFACTURER" | grep -qi "xiaomi\|miui\|redmi\|poco"; then
  echo -e "\n${BOLD}${CYAN}--- Xiaomi/MIUI Bloat ---${RESET}"
  for pkg in \
    com.miui.analytics \
    com.miui.msa.global \
    com.miui.cloudbackup \
    com.miui.cloudservice \
    com.miui.micloudsync \
    com.xiaomi.micloud.sdk \
    com.miui.extraphoto \
    com.miui.phrase \
    com.miui.audiomonitor \
    com.miui.fm \
    com.miui.compass \
    com.xiaomi.barrage \
    com.xiaomi.discover \
    com.xiaomi.NetworkBoost \
    com.miui.aod \
    com.android.thememanager \
    com.milink.service \
    com.xiaomi.finddevice \
    com.xiaomi.xmsf \
    com.xiaomi.mtb \
    com.xiaomi.xmsfkeeper \
    com.miui.miwallpaper \
    com.miui.miinput \
    com.miui.powerkeeper \
    com.mi.globalbrowser \
    com.xiaomi.scanner
  do disable_pkg "$pkg"; done
fi

if echo "$MANUFACTURER" | grep -qi "samsung"; then
  echo -e "\n${BOLD}${CYAN}--- Samsung Bloat ---${RESET}"
  for pkg in \
    com.samsung.android.bixby.agent \
    com.samsung.android.bixby.service \
    com.samsung.android.bixby.wakeup \
    com.samsung.android.app.spage \
    com.samsung.android.game.gametools \
    com.samsung.android.game.gamehome \
    com.sec.android.app.sbrowser \
    com.samsung.android.weather \
    com.samsung.android.app.tips \
    com.samsung.android.wellbeing \
    com.samsung.android.livestalling \
    com.samsung.android.app.routines \
    com.samsung.android.app.galaxy
  do disable_pkg "$pkg"; done
fi

if echo "$MANUFACTURER" | grep -qi "oneplus\|oppo\|realme\|coloros"; then
  echo -e "\n${BOLD}${CYAN}--- OnePlus/Oppo/Realme Bloat ---${RESET}"
  for pkg in \
    com.oneplus.brickmode \
    com.oneplus.shelf \
    com.coloros.weather \
    com.coloros.assistant \
    com.oppo.market
  do disable_pkg "$pkg"; done
fi

if echo "$MANUFACTURER" | grep -qi "huawei\|honor"; then
  echo -e "\n${BOLD}${CYAN}--- Huawei Bloat ---${RESET}"
  for pkg in \
    com.huawei.himovie.overseas \
    com.huawei.health \
    com.huawei.tips
  do disable_pkg "$pkg"; done
fi

if echo "$MANUFACTURER" | grep -qi "motorola\|moto\|lenovo"; then
  echo -e "\n${BOLD}${CYAN}--- Motorola Bloat ---${RESET}"
  for pkg in \
    com.motorola.brapps \
    com.motorola.motosignature.app
  do disable_pkg "$pkg"; done
fi

echo -e "\n${BOLD}${CYAN}=============================="
echo -e "         SUMMARY"
echo -e "==============================${RESET}"
echo -e "${GREEN}Disabled: $disabled${RESET}"
echo -e "${YELLOW}Skipped:  $skipped${RESET}"
echo -e "${RED}Failed:   $failed${RESET}"
echo -e "${BOLD}${CYAN}==============================${RESET}\n"
