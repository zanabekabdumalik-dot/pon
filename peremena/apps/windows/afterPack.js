// Puts the «Перемена» icon and file description into Peremena.exe without Wine (pure-JS resedit).
const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const ResEdit = await import('resedit');
  const PE = await import('pe-library');
  const exePath = path.join(context.appOutDir, context.packager.appInfo.productFilename + '.exe');
  const exe = PE.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
  const res = PE.NtExecutableResource.from(exe);

  const icon = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, 'icon.ico')));
  const group = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries)[0];
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, group.id, group.lang, icon.icons.map(i => i.data));

  // Rewrite every string table Electron ships (usually en-US) so Windows shows our name, not "Electron".
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
  for (const lang of vi.getAllLanguagesForStringValues()) {
    vi.setStringValues(lang, {
      ProductName: 'Перемена',
      FileDescription: 'Перемена — фокус-таймер с разминкой',
      CompanyName: 'Школьный проект, 11 класс',
      InternalName: 'Peremena',
      OriginalFilename: 'Peremena.exe',
      LegalCopyright: '',
      FileVersion: '1.0.0',
      ProductVersion: '1.0.0',
    });
  }
  vi.setFileVersion(1, 0, 0, 0);
  vi.setProductVersion(1, 0, 0, 0);
  vi.outputToResourceEntries(res.entries);

  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  console.log('  • icon and version info set on', path.basename(exePath));
};
