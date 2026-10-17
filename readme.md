# <img src="https://github.com/FilipePS/Traduzir-paginas-web/blob/master/src/icons/icon-128.png" height="50"> TWP-srsn

[FilipePS/Traduzir-paginas-web](https://github.com/FilipePS/Traduzir-paginas-web) の Chrome MV3 版をベースにした、非公式のフォークです。

## このフォークについて

本プロジェクトでは、TWP に **Sarashina Translate API**（日本語⇔英語）を翻訳バックエンドとして新たに追加しました。ページ全体の翻訳だけでなく、選択したテキストの翻訳にも対応しています。

なお、このフォークは個人によるものであり、API を提供している組織とは関係ありません。

### 主な変更点

- 翻訳サービスに「Sarashina」を追加しました。オプション画面の「Experimental（実験的）」タブで API キーを登録すると、翻訳エンジンの選択肢に表示されます。
- API のレート制限（1 分間に 6 リクエストまで、1 リクエストあたり最大 5,000 文字）に配慮して、送信を最適化しています。
  - ページ全体を一度に処理できるよう、1 リクエストに最大 4,500 文字まで複数の段落をまとめて送信します。
  - 利用可能な送信枠に均等に分割して並列処理を行います。ただし、1 枠は常に「選択したテキストの翻訳」用に確保しています。
  - 画面上に表示されている段落を優先して翻訳します。
  - 数式などによって不自然に分割された段落は、可能な限り一つの文としてまとめて翻訳します。
- 翻訳の進行状況をポップアップに表示するようにしました。具体的には、「すでに翻訳された段落数」「現在待機中の文字数」「次に送信できるまでの残り時間」などがわかります。
- ポップアップから、「選択したテキストを翻訳するボタンを表示」の設定と「翻訳を改善する」ボタンを外しました。

### インストール方法（Chrome / Edge / Brave）

1. [Releases](https://github.com/hirobon1690/TWP-srsn/releases/latest) から最新の `chrome.zip` をダウンロードし、任意の場所に展開します。展開したフォルダは、使い続ける間は削除・移動しないでください。
2. ブラウザで `chrome://extensions` にアクセスし、「デベロッパーモード」を有効にします。
3. 「パッケージ化されていない拡張機能を読み込む」を選択し、展開したフォルダ（`manifest.json` が入っているフォルダ）を指定します。
4. オプション画面の「実験的」（Experimental）タブにある「Sarashina Config」で、API キーを登録します。
5. ページ翻訳の設定で、翻訳サービスとして「Sarashina (ja/en)」を選択します。

本家の TWP がすでに入っている場合は、競合しないように無効にしてください。自動更新はないため、新しいバージョンが出たときは ZIP をダウンロードし直してフォルダの中身を入れ替え、`chrome://extensions` で拡張機能を再読み込みしてください。

### インストール方法（Firefox）

1. [Releases](https://github.com/hirobon1690/TWP-srsn/releases/latest) から最新の `firefox.zip` をダウンロードします（展開は不要です）。
2. Firefox で `about:debugging#/runtime/this-firefox` を開き、「一時的なアドオンを読み込む…」から、ダウンロードした ZIP を選択します。
3. 以降の設定は Chrome と同じです。

この方法で読み込んだアドオンは、Firefox を再起動すると消えます（Mozilla の署名がないため、通常の Firefox には常にインストールしておくことができません）。Firefox Developer Edition や Nightly では、`about:config` で `xpinstall.signatures.required` を `false` にすると、署名のないアドオンをインストールできますが、この方法は試していません。

### 制限事項

- 対応しているのは現在、**日本語と英語の間のみ**です。それ以外の言語ペアについては、設定に応じて別の翻訳サービスが使用されます。
- レート制限の関係上、長いページの翻訳には数分かかる場合があります（目安：1 分あたり約 22,500 文字の処理速度）。
- Sarashina を使用中は、画像の代替テキスト（`alt` 属性）やツールチップ（`title` 属性）は翻訳されません。
- 段落内にリンクなどの要素が含まれている場合、翻訳後の文章内でそれらの位置が元と異なることがあります。

---

以下は本家の README です。

Translate your page in real time using Google, Bing or Yandex.

[![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/FilipePS/Traduzir-paginas-web?label=latest%20version&sort=semver)](https://github.com/FilipePS/Traduzir-paginas-web/releases)
[![GitHub release date](https://img.shields.io/github/release-date/FilipePS/Traduzir-paginas-web?labely)](https://github.com/FilipePS/Traduzir-paginas-web/latest)
[![GitHub issues](https://img.shields.io/github/issues/FilipePS/Traduzir-paginas-web?color=red)](https://github.com/FilipePS/Traduzir-paginas-web/issues)
[![GitHub license](https://img.shields.io/github/license/FilipePS/Traduzir-paginas-web?color=lightgrey)](https://github.com/FilipePS/Traduzir-paginas-web/blob/master/LICENSE)

## Install

### Firefox
- Desktop users, download from [Mozilla Addons](https://addons.mozilla.org/firefox/addon/traduzir-paginas-web/).
- Android users
  1. Install the latest version of _Firefox (v120+)_.
  2. Open the extension manager.
  3. Scroll down and click **Find more add-ons**.
  4. On the add-ons website, search for **TWP**.
  5. Install the **TWP - Translate For Mobile** extension.

### Chrome, Edge and Brave
- The extension will be officially released for these browsers in the future.
- If you installed the extension in these browsers previously through a registry modification, please undo those changes.\
Note: If you want to undo registry changes, download and run this [twp-registry-uninstall-self.reg](https://raw.githubusercontent.com/FilipePS/Traduzir-paginas-web/master/dist/chromium/twp-registry-uninstall-self.reg). If you want a deeper removal download and run this other file [twp-registry-uninstall-all.reg](https://raw.githubusercontent.com/FilipePS/Traduzir-paginas-web/master/dist/chromium/twp-registry-uninstall-all.reg)

## Screenshots
| Menu 1 | Menu 2 | Translated |
| :--: | :--: | :--: |
| <img src="https://addons.mozilla.org/user-media/previews/full/258/258434.png" height="200"> | <img src="https://addons.mozilla.org/user-media/previews/full/258/258435.png" height="200"> | <img src="https://addons.mozilla.org/user-media/previews/full/258/258436.png" height="200"> |

## Contribute

- To collaborate with the translation of the extension interface use [Crowdin](https://crowdin.com/project/translate-web-pages).

## Donations

To make a donation use [Patreon](https://www.patreon.com/filipeps).

[<img src="https://github.com/FilipePS/Traduzir-paginas-web/blob/master/src/icons/patreon.png" alt="Patreon" height="50">](https://www.patreon.com/filipeps)

## FAQ

**What can this extension do?**

Your current page is translated without having to open new tabs.
It is possible to change the translation language.
You can select to automatically translate.
To change the translation engine just touch the Google Translate icon. 

**Why do you need to access your data on all the websites you visit?**

To translate any website it is necessary to access and modify the text of the web pages. And the extension can only do that, with that permission.

**How are the pages translated?**

The pages are translated using the Google or Yandex translation engine (you choose).

**And how's my privacy?**

[Privacy policy](https://addons.mozilla.org/addon/traduzir-paginas-web/privacy/): We do not collect any information. However, to translate, the contents of the web pages will be sent to Google or Yandex servers.

**Limitations**

Some pages like [support.mozilla.org](https://support.mozilla.org/) and [addons.mozilla.org](http://addons.mozilla.org/) will not be translated. For security reasons, the browser blocks extensions from accessing these sites.

## Build instructions
- You can see all the build instructions in the [build-instructions.md](build-instructions.md) file.
