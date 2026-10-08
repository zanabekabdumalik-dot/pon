#!/usr/bin/env python3
"""Собирает неподписанный APK без Android SDK.

Делает то, что обычно делает aapt2: кодирует AndroidManifest.xml и XML
адаптивной иконки в бинарный формат Android, пишет таблицу ресурсов
resources.arsc и складывает всё вместе с classes.dex и игрой (assets/www)
в zip, где несжатые записи выровнены по 4 байта.

    python3 tools/build_apk.py --dex build/classes.dex --out build/unsigned.apk
"""
import argparse
import os
import re
import struct
import xml.etree.ElementTree as ET
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)            # gappo/android
GAME = os.path.dirname(ROOT)            # gappo
ANDROID_NS = 'http://schemas.android.com/apk/res/android'

# Идентификаторы атрибутов из android.R.attr (сверены с android-all 14).
ATTR_IDS = {
    'theme': 0x01010000, 'label': 0x01010001, 'icon': 0x01010002, 'name': 0x01010003,
    'exported': 0x01010010, 'launchMode': 0x0101001d, 'screenOrientation': 0x0101001e,
    'configChanges': 0x0101001f, 'drawable': 0x01010199, 'minSdkVersion': 0x0101020c,
    'versionCode': 0x0101021b, 'versionName': 0x0101021c, 'targetSdkVersion': 0x01010270,
    'allowBackup': 0x01010280, 'hardwareAccelerated': 0x010102d3,
}
CONFIG_FLAGS = {  # android.content.pm.ActivityInfo.CONFIG_*
    'keyboard': 0x10, 'keyboardHidden': 0x20, 'orientation': 0x80, 'screenLayout': 0x100,
    'uiMode': 0x200, 'screenSize': 0x400, 'smallestScreenSize': 0x800, 'density': 0x1000,
}
ENUMS = {
    'screenOrientation': {'portrait': 1},
    'launchMode': {'standard': 0, 'singleTop': 1, 'singleTask': 2, 'singleInstance': 3},
}
INT_ATTRS = {'versionCode', 'minSdkVersion', 'targetSdkVersion'}
BOOL_ATTRS = {'exported', 'allowBackup', 'hardwareAccelerated'}

T_REFERENCE, T_STRING, T_INT_DEC, T_INT_HEX, T_INT_BOOLEAN = 0x01, 0x03, 0x10, 0x11, 0x12

# ---------- ресурсы: одна «папка» mipmap ----------
PACKAGE = 'com.gappo.game'
PKG_ID = 0x7f
MIPMAP = ['ic_launcher', 'ic_launcher_fg', 'ic_launcher_bg']
RES_IDS = {'@mipmap/' + n: (PKG_ID << 24) | (1 << 16) | i for i, n in enumerate(MIPMAP)}
DENSITY_XXXHDPI, DENSITY_ANY = 640, 0xFFFE
CONFIGS = [
    # (плотность, sdk, {запись: путь в APK})
    (DENSITY_XXXHDPI, 4, {
        'ic_launcher': 'res/mipmap-xxxhdpi-v4/ic_launcher.png',
        'ic_launcher_fg': 'res/mipmap-xxxhdpi-v4/ic_launcher_fg.png',
        'ic_launcher_bg': 'res/mipmap-xxxhdpi-v4/ic_launcher_bg.png',
    }),
    (DENSITY_ANY, 26, {'ic_launcher': 'res/mipmap-anydpi-v26/ic_launcher.xml'}),
]
ADAPTIVE_ICON = f'''<adaptive-icon xmlns:android="{ANDROID_NS}">
  <background android:drawable="@mipmap/ic_launcher_bg"/>
  <foreground android:drawable="@mipmap/ic_launcher_fg"/>
</adaptive-icon>'''


def string_pool(strings):
    """ResStringPool в UTF-16."""
    offsets, data = [], b''
    for s in strings:
        offsets.append(len(data))
        u = s.encode('utf-16-le')
        n = len(u) // 2
        data += (struct.pack('<HH', 0x8000 | (n >> 16), n & 0xFFFF) if n > 0x7FFF else struct.pack('<H', n)) + u + b'\0\0'
    data += b'\0' * (-len(data) % 4)
    header = 28
    start = header + 4 * len(strings)
    return struct.pack('<HHIIIIII', 0x0001, header, start + len(data), len(strings), 0, 0, start, 0) + \
        b''.join(struct.pack('<I', o) for o in offsets) + data


# ---------- бинарный XML ----------
def attr_value(name, raw):
    if raw.startswith('@'):
        return T_REFERENCE, RES_IDS[raw]
    if name in INT_ATTRS:
        return T_INT_DEC, int(raw)
    if name in BOOL_ATTRS:
        return T_INT_BOOLEAN, 0xFFFFFFFF if raw == 'true' else 0
    if name == 'configChanges':
        v = 0
        for f in raw.split('|'):
            v |= CONFIG_FLAGS[f]
        return T_INT_HEX, v
    if name in ENUMS:
        return T_INT_DEC, ENUMS[name][raw]
    return T_STRING, None


def encode_xml(text):
    root = ET.fromstring(text)
    # имена атрибутов с resource id идут первыми — их же перечисляет карта ресурсов
    res_names, other = [], []

    def add(lst, s):
        if s not in res_names and s not in other:
            lst.append(s)

    def walk(el):
        for k in el.attrib:
            ns, local = split(k)
            if ns == ANDROID_NS:
                add(res_names, local)
        for c in el:
            walk(c)
    walk(root)
    res_names.sort(key=lambda n: ATTR_IDS[n])

    def walk2(el):
        add(other, el.tag)
        for k, v in el.attrib.items():
            ns, local = split(k)
            if ns != ANDROID_NS:
                add(other, local)
            if attr_value(local, v)[0] == T_STRING:
                add(other, v)
        for c in el:
            walk2(c)
    add(other, 'android')
    add(other, ANDROID_NS)
    walk2(root)
    strings = res_names + other
    idx = {s: i for i, s in enumerate(strings)}
    NONE = 0xFFFFFFFF

    chunks = []
    resmap = struct.pack('<HHI', 0x0180, 8, 8 + 4 * len(res_names)) + b''.join(struct.pack('<I', ATTR_IDS[n]) for n in res_names)
    chunks.append(struct.pack('<HHIIIII', 0x0100, 16, 24, 1, NONE, idx['android'], idx[ANDROID_NS]))

    def emit(el, line=[1]):
        line[0] += 1
        attrs = []
        for k, v in el.attrib.items():
            ns, local = split(k)
            typ, data = attr_value(local, v)
            raw = NONE
            if typ == T_STRING:
                raw = data = idx[v]
            attrs.append((ATTR_IDS.get(local, 0xFFFFFFFF) if ns == ANDROID_NS else 0xFFFFFFFF + 1,
                          struct.pack('<IIIHBBI', idx[ANDROID_NS] if ns == ANDROID_NS else NONE, idx[local], raw, 8, 0, typ, data)))
        attrs.sort(key=lambda a: a[0])
        body = b''.join(a[1] for a in attrs)
        ext = struct.pack('<IIHHHHHH', NONE, idx[el.tag], 20, 20, len(attrs), 0, 0, 0)
        chunks.append(struct.pack('<HHIII', 0x0102, 16, 16 + len(ext) + len(body), line[0], NONE) + ext + body)
        for c in el:
            emit(c)
        chunks.append(struct.pack('<HHIIIII', 0x0103, 16, 24, line[0], NONE, NONE, idx[el.tag]))
    emit(root)
    chunks.append(struct.pack('<HHIIIII', 0x0101, 16, 24, 1, NONE, idx['android'], idx[ANDROID_NS]))
    body = string_pool(strings) + resmap + b''.join(chunks)
    return struct.pack('<HHI', 0x0003, 8, 8 + len(body)) + body


def split(key):
    if key.startswith('{'):
        ns, local = key[1:].split('}')
        return ns, local
    return None, key


# ---------- resources.arsc ----------
def res_config(density, sdk):
    b = struct.pack('<I', 64) + struct.pack('<HH', 0, 0) + b'\0' * 4
    b += struct.pack('<BBH', 0, 0, density) + b'\0' * 4 + struct.pack('<HH', 0, 0)
    b += struct.pack('<HH', sdk, 0) + struct.pack('<BBH', 0, 0, 0) + struct.pack('<HH', 0, 0)
    b += b'\0' * 12 + struct.pack('<BBH', 0, 0, 0)
    return b + b'\0' * (64 - len(b))


def encode_arsc():
    values = [path for _, _, files in CONFIGS for path in files.values()]
    vidx = {v: i for i, v in enumerate(values)}
    type_pool = string_pool(['mipmap'])
    key_pool = string_pool(MIPMAP)
    n = len(MIPMAP)
    spec = struct.pack('<HHIBBHI', 0x0202, 16, 16 + 4 * n, 1, 0, 0, n) + struct.pack('<' + 'I' * n, *([0x0500] * n))
    types = b''
    for density, sdk, files in CONFIGS:
        cfg = res_config(density, sdk)
        header = 20 + len(cfg)
        offsets, entries = [], b''
        for i, name in enumerate(MIPMAP):
            if name not in files:
                offsets.append(0xFFFFFFFF)
                continue
            offsets.append(len(entries))
            entries += struct.pack('<HHI', 8, 0, i) + struct.pack('<HBBI', 8, 0, T_STRING, vidx[files[name]])
        start = header + 4 * n
        types += struct.pack('<HHIBBHII', 0x0201, header, start + len(entries), 1, 0, 0, n, start) + cfg + \
            struct.pack('<' + 'I' * n, *offsets) + entries
    pkg_header = 288
    name16 = PACKAGE.encode('utf-16-le').ljust(256, b'\0')
    type_off = pkg_header
    key_off = type_off + len(type_pool)
    pkg_body = type_pool + key_pool + spec + types
    pkg = struct.pack('<HHII', 0x0200, pkg_header, pkg_header + len(pkg_body), PKG_ID) + name16 + \
        struct.pack('<IIIII', type_off, 1, key_off, n, 0) + pkg_body
    gpool = string_pool(values)
    body = gpool + pkg
    return struct.pack('<HHII', 0x0002, 12, 12 + len(body), 1) + body


# ---------- игра и шрифты ----------
FONT_FACES = [('nunito', w) for w in (600, 700, 800, 900)] + [('unbounded', w) for w in (600, 800)]
SUBSETS = ('cyrillic', 'latin')


def game_files():
    files = {}
    html = open(os.path.join(GAME, 'index.html'), encoding='utf-8').read()
    html, n = re.subn(r'<link rel="preconnect"[^>]*>\n|<link rel="stylesheet" href="https://fonts\.googleapis\.com[^>]*>',
                      '', html)
    assert n == 3, 'не нашёл ссылки на Google Fonts в index.html'
    html = html.replace('<title>', '<link rel="stylesheet" href="fonts/fonts.css">\n<title>', 1)
    files['assets/www/index.html'] = html.encode('utf-8')
    css = []
    for fam, weight in FONT_FACES:
        pkg = os.path.join(ROOT, 'node_modules', '@fontsource', fam)
        src = open(os.path.join(pkg, f'{weight}.css'), encoding='utf-8').read()
        for block in re.findall(r'/\* [^*]+ \*/\n@font-face \{.*?\}', src, re.S):
            sub = re.match(r'/\* ' + fam + r'-(.+?)-' + str(weight) + r'-normal \*/', block)
            if not sub or sub.group(1) not in SUBSETS:
                continue
            fname = f'{fam}-{sub.group(1)}-{weight}-normal.woff2'
            files['assets/www/fonts/' + fname] = open(os.path.join(pkg, 'files', fname), 'rb').read()
            block = re.sub(r"src: url\(\./files/([^)]+\.woff2)\) format\('woff2'\), url\([^)]+\) format\('woff'\);",
                           r"src: url(\1) format('woff2');", block)
            css.append(block)
        lic = os.path.join(pkg, 'LICENSE')
        if os.path.exists(lic):
            files[f'assets/www/fonts/LICENSE-{fam}.txt'] = open(lic, 'rb').read()
    files['assets/www/fonts/fonts.css'] = ('\n\n'.join(css) + '\n').encode('utf-8')
    return files


def write_apk(out, entries):
    """entries: [(путь, байты, сжимать?)]. Несжатые записи выравниваются по 4 байта."""
    with zipfile.ZipFile(out, 'w') as z:
        for name, data, deflate in entries:
            zi = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            zi.external_attr = 0o644 << 16
            if deflate:
                zi.compress_type = zipfile.ZIP_DEFLATED
            else:
                zi.compress_type = zipfile.ZIP_STORED
                pos = z.fp.tell() + 30 + len(name.encode('utf-8'))
                pad = (-(pos + 6)) % 4
                zi.extra = struct.pack('<HHH', 0xD935, 2 + pad, 4) + b'\0' * pad
            z.writestr(zi, data)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dex', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    manifest = encode_xml(open(os.path.join(ROOT, 'AndroidManifest.xml'), encoding='utf-8').read())
    entries = [
        ('AndroidManifest.xml', manifest, True),
        ('classes.dex', open(a.dex, 'rb').read(), True),
        ('resources.arsc', encode_arsc(), False),
        ('res/mipmap-anydpi-v26/ic_launcher.xml', encode_xml(ADAPTIVE_ICON), True),
    ]
    for _, _, files in CONFIGS:
        for path in files.values():
            if path.endswith('.png'):
                entries.append((path, open(os.path.join(ROOT, 'res', os.path.basename(path)), 'rb').read(), False))
    for path, data in sorted(game_files().items()):
        entries.append((path, data, not path.endswith('.woff2')))
    write_apk(a.out, entries)
    print(f'{a.out}: {len(entries)} записей, {os.path.getsize(a.out) // 1024} КБ')


if __name__ == '__main__':
    main()
