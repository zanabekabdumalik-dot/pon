"""Minimal zipalign: rewrite an APK so every STORED entry's data starts on a 4-byte boundary.

Uses the standard 0xD935 alignment extra field (what Android's zipalign writes).
usage: python3 zipalign.py <in.apk> <out.apk>
"""
import struct
import sys
import zipfile

ALIGN = 4


def main(src, dst):
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, 'w') as zout:
        for info in zin.infolist():
            data = zin.read(info.filename)
            out = zipfile.ZipInfo(info.filename, info.date_time)
            out.compress_type = info.compress_type
            out.external_attr = info.external_attr
            if info.compress_type == zipfile.ZIP_STORED:
                start = zout.fp.tell() + 30 + len(info.filename.encode()) + 6
                pad = (-start) % ALIGN
                out.extra = struct.pack('<HHH', 0xD935, 2 + pad, ALIGN) + b'\0' * pad
            zout.writestr(out, data)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
