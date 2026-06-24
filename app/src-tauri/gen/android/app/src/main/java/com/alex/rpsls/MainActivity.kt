package com.alex.rpsls

import android.content.res.Configuration
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  private var webViewRef: WebView? = null

  // ROTATION : le manifest a configChanges="orientation|screenSize" → l'activité
  // n'est PAS recréée à la rotation, donc le listener d'insets ne se redéclenche
  // pas tout seul et --sai-* resterait figé sur l'orientation initiale (haut/bas
  // coupés en paysage). On force ici une nouvelle passe d'insets à chaque
  // changement de config (rotation portrait ⇄ paysage).
  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    val v = webViewRef ?: return
    // Léger délai : laisser le layout s'installer dans la nouvelle orientation
    // avant de relire les insets (sinon on peut lire l'ancienne géométrie).
    Handler(Looper.getMainLooper()).postDelayed({ ViewCompat.requestApplyInsets(v) }, 60)
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    // Pont SAFE-AREA : Tauri/Android dessine edge-to-edge (sous la barre d'état
    // + la barre de navigation), et la WebView ne propage PAS toujours
    // env(safe-area-inset-*). On lit donc les VRAIS insets système et on les
    // injecte dans la page en variables CSS (--sai-top/right/bottom/left). Exact,
    // et remis à jour à chaque rotation (portrait ⇄ paysage).
    setupSafeAreaInsets()

    // Intercept Android back button:
    //   1. If the WebView has history (i.e. the JS app pushed a state),
    //      navigate back → popstate fires in JS → app handles route change.
    //   2. Otherwise, disable our callback and re-dispatch → default behavior
    //      (close the activity).
    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        val webView = findWebView(window.decorView)
        if (webView != null && webView.canGoBack()) {
          webView.goBack()
        } else {
          isEnabled = false
          onBackPressedDispatcher.onBackPressed()
        }
      }
    })
  }

  private fun setupSafeAreaInsets() {
    val webView = findWebView(window.decorView)
    if (webView == null) {
      // La WebView est créée de façon asynchrone par Tauri → on réessaie au
      // prochain tick jusqu'à ce qu'elle existe.
      Handler(Looper.getMainLooper()).postDelayed({ setupSafeAreaInsets() }, 80)
      return
    }
    webViewRef = webView
    ViewCompat.setOnApplyWindowInsetsListener(webView) { _, insets ->
      val bars = insets.getInsets(
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
      )
      val d = resources.displayMetrics.density
      val js =
        "var r=document.documentElement.style;" +
        "r.setProperty('--sai-top','" + (bars.top / d) + "px');" +
        "r.setProperty('--sai-right','" + (bars.right / d) + "px');" +
        "r.setProperty('--sai-bottom','" + (bars.bottom / d) + "px');" +
        "r.setProperty('--sai-left','" + (bars.left / d) + "px');"
      webView.evaluateJavascript(js, null)
      // On NE consomme PAS les insets (retour `insets`) : la WebView reste libre
      // d'alimenter aussi env() si jamais elle le sait.
      insets
    }
    // Force une 1re passe d'insets maintenant que la WebView existe.
    ViewCompat.requestApplyInsets(webView)
  }

  private fun findWebView(v: View): WebView? {
    if (v is WebView) return v
    if (v is ViewGroup) {
      for (i in 0 until v.childCount) {
        val r = findWebView(v.getChildAt(i))
        if (r != null) return r
      }
    }
    return null
  }
}
