import com.android.apksig.ApkSigner;
import com.android.apksig.ApkVerifier;

import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;

/**
 * Подписывает APK схемой v2 и сразу проверяет подпись. Аргументы: вход выход keystore пароль alias.
 * Схема v1 не нужна: minSdk 24 (Android 7.0) понимает v2, а v1 в apksig 2.3.0 не работает на JDK 17+.
 */
public class Sign {
    public static void main(String[] a) throws Exception {
        File in = new File(a[0]), out = new File(a[1]);
        char[] pass = a[3].toCharArray();
        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (FileInputStream f = new FileInputStream(a[2])) {
            ks.load(f, pass);
        }
        PrivateKey key = (PrivateKey) ks.getKey(a[4], pass);
        X509Certificate cert = (X509Certificate) ks.getCertificate(a[4]);
        ApkSigner.SignerConfig cfg = new ApkSigner.SignerConfig.Builder("gappo", key, Collections.singletonList(cert)).build();
        new ApkSigner.Builder(Collections.singletonList(cfg))
                .setInputApk(in).setOutputApk(out)
                .setMinSdkVersion(24)
                .setV1SigningEnabled(false).setV2SigningEnabled(true)
                .setCreatedBy("gappo build")
                .build().sign();

        ApkVerifier.Result r = new ApkVerifier.Builder(out).build().verify();
        System.out.println("подпись верна: " + r.isVerified() + " (v2: " + r.isVerifiedUsingV2Scheme() + ")");
        for (Object e : r.getErrors()) System.out.println("ошибка: " + e);
        for (Object w : r.getWarnings()) System.out.println("предупреждение: " + w);
        if (!r.isVerified()) System.exit(1);
    }
}
