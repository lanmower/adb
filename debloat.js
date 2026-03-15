#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');

const CORE_SAFE_LIST = new Set([
  'android',
  'com.android.systemui',
  'com.android.phone',
  'com.android.settings',
  'com.google.android.gms',
  'com.google.android.gms.persistent',
  'com.android.vending',
  'com.android.providers.telephony',
  'com.android.providers.contacts',
  'com.android.providers.media',
  'com.android.bluetooth',
  'com.android.wifi.resources',
]);

const LIST_ONLY = process.argv.includes('--list-only');

function adb(cmd, opts = {}) {
  const serial = process.env.ANDROID_SERIAL ? `-s ${process.env.ANDROID_SERIAL}` : '';
  const full = `adb ${serial} ${cmd}`.trim();
  try {
    return execSync(full, { encoding: 'utf8', timeout: opts.timeout || 30000 });
  } catch (e) {
    if (opts.allowFail) return '';
    throw e;
  }
}

function getDeviceSerial() {
  const out = execSync('adb devices', { encoding: 'utf8' });
  const lines = out.trim().split('\n').slice(1).filter(l => l.includes('\tdevice'));
  if (lines.length === 0) throw new Error('No ADB device connected. Connect a device or set ANDROID_SERIAL.');
  if (process.env.ANDROID_SERIAL) return process.env.ANDROID_SERIAL;
  if (lines.length > 1) {
    console.warn(`Warning: multiple devices found. Using first: ${lines[0].split('\t')[0]}`);
    console.warn('Set ANDROID_SERIAL env to specify a device.');
  }
  return lines[0].split('\t')[0];
}

function getDeviceInfo(serial) {
  process.env.ANDROID_SERIAL = serial;
  const model = adb('shell getprop ro.product.model', { allowFail: true }).trim() || 'Unknown';
  const android = adb('shell getprop ro.build.version.release', { allowFail: true }).trim() || '?';
  const memRaw = adb('shell cat /proc/meminfo', { allowFail: true });
  let totalMB = 0, freeMB = 0;
  for (const line of memRaw.split('\n')) {
    const m = line.match(/^MemTotal:\s+(\d+)\s+kB/);
    const f = line.match(/^MemAvailable:\s+(\d+)\s+kB/);
    if (m) totalMB = Math.round(parseInt(m[1]) / 1024);
    if (f) freeMB = Math.round(parseInt(f[1]) / 1024);
  }
  const usedMB = totalMB - freeMB;
  return { model, android, totalMB, usedMB };
}

function getPackages() {
  const systemRaw = adb('shell pm list packages -s', { allowFail: true });
  const userRaw = adb('shell pm list packages -3', { allowFail: true });
  const systemSet = new Set(
    systemRaw.split('\n').map(l => l.replace('package:', '').trim()).filter(Boolean)
  );
  const userSet = new Set(
    userRaw.split('\n').map(l => l.replace('package:', '').trim()).filter(Boolean)
  );
  const allSet = new Set([...systemSet, ...userSet]);
  return { allSet, systemSet, userSet };
}

function parseMeminfo() {
  const raw = adb('shell dumpsys meminfo', { timeout: 60000, allowFail: true });
  const rss = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s+([\d,]+)K:\s+(\S+)\s+\(/);
    if (m) {
      const kb = parseInt(m[1].replace(/,/g, ''));
      const proc = m[2].trim();
      const pkg = proc.includes(':') ? proc.split(':')[0] : proc;
      if (!rss[pkg] || rss[pkg] < kb) rss[pkg] = kb;
    }
  }
  return rss;
}

function getRssMB(pkg, meminfo) {
  const kb = meminfo[pkg] || 0;
  return Math.round(kb / 1024);
}

function pad(str, len) {
  return String(str).padStart(len);
}

function rpad(str, len) {
  return String(str).padEnd(len);
}

async function main() {
  let serial;
  try {
    serial = getDeviceSerial();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  process.env.ANDROID_SERIAL = serial;
  console.log('Fetching device info...');
  const info = getDeviceInfo(serial);

  console.log('Enumerating packages...');
  const { allSet, systemSet } = getPackages();

  console.log(`Parsing memory info (${allSet.size} packages)...`);
  const meminfo = parseMeminfo();

  const packages = Array.from(allSet).map(pkg => ({
    pkg,
    isSystem: systemSet.has(pkg),
    rssMB: getRssMB(pkg, meminfo),
    core: CORE_SAFE_LIST.has(pkg),
  }));

  packages.sort((a, b) => b.rssMB - a.rssMB);

  const ramStr = `${info.usedMB}MB used / ${info.totalMB}MB`;
  console.log(`\n=== Android Debloat Tool ===`);
  console.log(`Device: ${info.model} | Android ${info.android} | RAM: ${ramStr}`);
  console.log(`Serial: ${serial}`);
  console.log('');

  if (LIST_ONLY) {
    const lines = packages.map((p, i) => {
      const idx = pad(i + 1, 4);
      const ram = pad(p.rssMB + 'MB', 7);
      const type = p.isSystem ? '[system]' : '[user]  ';
      const core = p.core ? ' (skip - core)' : '';
      return `[${idx}] ${ram}  ${rpad(p.pkg, 50)} ${type}${core}`;
    });
    console.log(lines.join('\n'));
    return;
  }

  const toDisable = [];
  const actionable = packages.filter(p => !p.core);

  const keypress = () => new Promise(resolve => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', buf => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve(buf.toString().toLowerCase());
    });
  });

  console.log('Controls: [d] disable  [k] keep  [s] skip remaining system  [q] quit & apply\n');

  let skipSystem = false;
  for (let i = 0; i < actionable.length; i++) {
    const p = actionable[i];
    if (skipSystem && p.isSystem) continue;
    const idx = pad(i + 1, 4);
    const ram = pad(p.rssMB > 0 ? p.rssMB + 'MB' : '---', 7);
    const type = p.isSystem ? '\x1b[33m[system]\x1b[0m' : '\x1b[32m[user]  \x1b[0m';
    process.stdout.write(`[${idx}/${actionable.length}] ${ram}  ${rpad(p.pkg, 50)} ${type}  `);
    const key = await keypress();
    if (key === 'd') { toDisable.push(p.pkg); process.stdout.write('\x1b[31mDISABLE\x1b[0m\n'); }
    else if (key === 's') { skipSystem = true; process.stdout.write('skip system\n'); }
    else if (key === 'q' || key === '\x03') { process.stdout.write('quit\n'); break; }
    else { process.stdout.write('keep\n'); }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Packages to disable: ${toDisable.length}`);

  if (toDisable.length === 0) {
    console.log('Nothing to disable. Exiting.');
    return;
  }

  for (const pkg of toDisable) {
    console.log(`Disabling: ${pkg}`);
    try {
      const out = adb(`shell pm disable-user --user 0 ${pkg}`, { allowFail: true }).trim();
      console.log(`  -> ${out || 'done'}`);
    } catch (e) {
      console.error(`  -> ERROR: ${e.message}`);
    }
  }

  console.log('\nDone. Disabled packages will take effect immediately.');
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
