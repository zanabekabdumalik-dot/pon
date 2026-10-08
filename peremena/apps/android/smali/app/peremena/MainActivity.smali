# The whole Android app: a full-screen WebView showing assets/index.html.
# The page is loaded with an https base URL so localStorage (points, timetable) persists.
.class public Lapp/peremena/MainActivity;
.super Landroid/app/Activity;
.source "MainActivity.java"


.method public constructor <init>()V
    .registers 1

    invoke-direct {p0}, Landroid/app/Activity;-><init>()V

    return-void
.end method


.method protected onCreate(Landroid/os/Bundle;)V
    .registers 12

    invoke-super {p0, p1}, Landroid/app/Activity;->onCreate(Landroid/os/Bundle;)V

    # Keep the screen on while the timer is open: Window.addFlags(FLAG_KEEP_SCREEN_ON)
    invoke-virtual {p0}, Lapp/peremena/MainActivity;->getWindow()Landroid/view/Window;
    move-result-object v0
    const/16 v1, 0x80
    invoke-virtual {v0, v1}, Landroid/view/Window;->addFlags(I)V

    # Notebook-paper system bars (#F5F7FB) with dark icons
    const v1, -0xa0805
    invoke-virtual {v0, v1}, Landroid/view/Window;->setStatusBarColor(I)V
    invoke-virtual {v0, v1}, Landroid/view/Window;->setNavigationBarColor(I)V
    invoke-virtual {v0}, Landroid/view/Window;->getDecorView()Landroid/view/View;
    move-result-object v2
    const/16 v3, 0x2010
    invoke-virtual {v2, v3}, Landroid/view/View;->setSystemUiVisibility(I)V

    # WebView with JavaScript and localStorage
    new-instance v2, Landroid/webkit/WebView;
    invoke-direct {v2, p0}, Landroid/webkit/WebView;-><init>(Landroid/content/Context;)V
    invoke-virtual {v2, v1}, Landroid/webkit/WebView;->setBackgroundColor(I)V
    invoke-virtual {v2}, Landroid/webkit/WebView;->getSettings()Landroid/webkit/WebSettings;
    move-result-object v3
    const/4 v4, 0x1
    invoke-virtual {v3, v4}, Landroid/webkit/WebSettings;->setJavaScriptEnabled(Z)V
    invoke-virtual {v3, v4}, Landroid/webkit/WebSettings;->setDomStorageEnabled(Z)V
    const/4 v4, 0x0
    invoke-virtual {v3, v4}, Landroid/webkit/WebSettings;->setMediaPlaybackRequiresUserGesture(Z)V

    # Read assets/index.html into a String
    invoke-virtual {p0}, Lapp/peremena/MainActivity;->getAssets()Landroid/content/res/AssetManager;
    move-result-object v3
    const-string v4, "index.html"
    invoke-virtual {v3, v4}, Landroid/content/res/AssetManager;->open(Ljava/lang/String;)Ljava/io/InputStream;
    move-result-object v3
    new-instance v4, Ljava/io/ByteArrayOutputStream;
    invoke-direct {v4}, Ljava/io/ByteArrayOutputStream;-><init>()V
    const/16 v5, 0x2000
    new-array v5, v5, [B

    :read_loop
    invoke-virtual {v3, v5}, Ljava/io/InputStream;->read([B)I
    move-result v6
    if-ltz v6, :read_done
    const/4 v7, 0x0
    invoke-virtual {v4, v5, v7, v6}, Ljava/io/ByteArrayOutputStream;->write([BII)V
    goto :read_loop

    :read_done
    invoke-virtual {v3}, Ljava/io/InputStream;->close()V

    # web.loadDataWithBaseURL("https://peremena.app/", html, "text/html", "UTF-8", null)
    const-string v6, "UTF-8"
    invoke-virtual {v4, v6}, Ljava/io/ByteArrayOutputStream;->toString(Ljava/lang/String;)Ljava/lang/String;
    move-result-object v4
    const-string v3, "https://peremena.app/"
    const-string v5, "text/html"
    const/4 v7, 0x0
    invoke-virtual/range {v2 .. v7}, Landroid/webkit/WebView;->loadDataWithBaseURL(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)V

    invoke-virtual {p0, v2}, Lapp/peremena/MainActivity;->setContentView(Landroid/view/View;)V

    return-void
.end method
