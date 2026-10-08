// Signs an APK with APK Signature Scheme v2 (Android 7.0+) using the apksig library.
// v1 (JAR) signing is off: apksig 2.3.0's v1 signer calls JDK internals removed in modern Java.
// usage: java -cp apksig.jar:. Sign <keystore.p12> <password> <in.apk> <out.apk>
import com.android.apksig.ApkSigner;
import com.android.apksig.ApkVerifier;
import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;

public class Sign {
    public static void main(String[] a) throws Exception {
        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (FileInputStream f = new FileInputStream(a[0])) {
            ks.load(f, a[1].toCharArray());
        }
        PrivateKey key = (PrivateKey) ks.getKey("peremena", a[1].toCharArray());
        X509Certificate cert = (X509Certificate) ks.getCertificate("peremena");
        ApkSigner.SignerConfig signer =
                new ApkSigner.SignerConfig.Builder("peremena", key, Collections.singletonList(cert)).build();
        new ApkSigner.Builder(Collections.singletonList(signer))
                .setInputApk(new File(a[2]))
                .setOutputApk(new File(a[3]))
                .setMinSdkVersion(24)
                .setV1SigningEnabled(false)
                .setV2SigningEnabled(true)
                .build()
                .sign();
        ApkVerifier.Result r = new ApkVerifier.Builder(new File(a[3])).build().verify();
        System.out.println("verified=" + r.isVerified() + " v1=" + r.isVerifiedUsingV1Scheme() + " v2=" + r.isVerifiedUsingV2Scheme());
        if (!r.isVerified()) {
            r.getErrors().forEach(e -> System.out.println("ERROR " + e));
            System.exit(1);
        }
    }
}
