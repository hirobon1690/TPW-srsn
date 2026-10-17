"use strict";

const translationService = (function () {
  const translationService = {};

  class Utils {
    /**
     * Replace the characters `& < > " '` with `&amp; &lt; &gt; &quot; &#39;`.
     *
     * Note: For bing translation, we want to use its custom dictionary feature,
     * we have to keep certain html tags, so we need to avoid them from being escaped.
     * These symbols are nothing, just to ensure that there are no such symbols in the original text.
     *
     * @param {string} unsafe
     * @returns {string} escapedString
     */
    static escapeHTML(unsafe) {
      const bingMarkFrontPart = '<mstrans:dictionary translation="';
      const bingMarkSecondPart = '"></mstrans:dictionary>';

      unsafe = unsafe
        .replaceAll(bingMarkFrontPart, "@-/629^*")
        .replaceAll(bingMarkSecondPart, "^$537+*");

      unsafe = unsafe
        .replace(/\&/g, "&amp;")
        .replace(/\</g, "&lt;")
        .replace(/\>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/\'/g, "&#39;");

      unsafe = unsafe
        .replaceAll("@-/629^*", bingMarkFrontPart)
        .replaceAll("^$537+*", bingMarkSecondPart);

      return unsafe;
    }

    /**
     * Replace the characters `&amp; &lt; &gt; &quot; &#39;` with `& < > " '`.
     * @param {string} unsafe
     * @returns {string} unescapedString
     */
    static unescapeHTML(unsafe) {
      return unsafe
        .replace(/\&amp;/g, "&")
        .replace(/\&lt;/g, "<")
        .replace(/\&gt;/g, ">")
        .replace(/\&quot;/g, '"')
        .replace(/\&\#39;/g, "'");
    }
  }

  class GoogleHelper {
    static get googleTranslateTKK() {
      return "448487.932609646";
    }

    /**
     *
     * @param {number} num
     * @param {string} optString
     * @returns {number}
     */
    static shiftLeftOrRightThenSumOrXor(num, optString) {
      for (let i = 0; i < optString.length - 2; i += 3) {
        /** @type {string|number} */
        let acc = optString.charAt(i + 2);
        if ("a" <= acc) {
          acc = acc.charCodeAt(0) - 87;
        } else {
          acc = Number(acc);
        }
        if (optString.charAt(i + 1) == "+") {
          acc = num >>> acc;
        } else {
          acc = num << acc;
        }
        if (optString.charAt(i) == "+") {
          num += acc & 4294967295;
        } else {
          num ^= acc;
        }
      }
      return num;
    }

    /**
     *
     * @param {string} query
     * @returns {Array<number>}
     */
    static transformQuery(query) {
      /** @type {Array<number>} */
      const bytesArray = [];
      let idx = 0;
      for (let i = 0; i < query.length; i++) {
        let charCode = query.charCodeAt(i);

        if (128 > charCode) {
          bytesArray[idx++] = charCode;
        } else {
          if (2048 > charCode) {
            bytesArray[idx++] = (charCode >> 6) | 192;
          } else {
            if (
              55296 == (charCode & 64512) &&
              i + 1 < query.length &&
              56320 == (query.charCodeAt(i + 1) & 64512)
            ) {
              charCode =
                65536 +
                ((charCode & 1023) << 10) +
                (query.charCodeAt(++i) & 1023);
              bytesArray[idx++] = (charCode >> 18) | 240;
              bytesArray[idx++] = ((charCode >> 12) & 63) | 128;
            } else {
              bytesArray[idx++] = (charCode >> 12) | 224;
            }
            bytesArray[idx++] = ((charCode >> 6) & 63) | 128;
          }
          bytesArray[idx++] = (charCode & 63) | 128;
        }
      }
      return bytesArray;
    }

    /**
     * Calculates the hash (TK) of a query for google translator.
     * @param {string} query
     * @returns {string}
     */
    static calcHash(query) {
      const windowTkk = GoogleHelper.googleTranslateTKK;
      const tkkSplited = windowTkk.split(".");
      const tkkIndex = Number(tkkSplited[0]) || 0;
      const tkkKey = Number(tkkSplited[1]) || 0;

      const bytesArray = GoogleHelper.transformQuery(query);

      let encondingRound = tkkIndex;
      for (const item of bytesArray) {
        encondingRound += item;
        encondingRound = GoogleHelper.shiftLeftOrRightThenSumOrXor(
          encondingRound,
          "+-a^+6",
        );
      }
      encondingRound = GoogleHelper.shiftLeftOrRightThenSumOrXor(
        encondingRound,
        "+-3^+b+-f",
      );

      encondingRound ^= tkkKey;
      if (encondingRound <= 0) {
        encondingRound = (encondingRound & 2147483647) + 2147483648;
      }

      const normalizedResult = encondingRound % 1000000;
      return normalizedResult.toString() + "." + (normalizedResult ^ tkkIndex);
    }
  }

  class GoogleHelper_v2 {
    /** @type {number} */
    static #lastRequestAuthTime = null;
    /** @type {string} */
    static #translateAuth = null;
    /** @type {boolean} */
    static #AuthNotFound = false;
    /** @type {Promise<void>} */
    static #authPromise = null;

    static get translateAuth() {
      return GoogleHelper_v2.#translateAuth;
    }

    /**
     * Find the Auth of Google Translator. The Auth value is used in translation requests.
     * @returns {Promise<void>}
     */
    static async findAuth() {
      if (GoogleHelper_v2.#authPromise)
        return await GoogleHelper_v2.#authPromise;

      GoogleHelper_v2.#authPromise = new Promise((resolve) => {
        let updateGoogleAuth = false;
        if (GoogleHelper_v2.#lastRequestAuthTime) {
          const date = new Date();
          if (GoogleHelper_v2.#translateAuth) {
            date.setMinutes(date.getMinutes() - 20);
          } else if (GoogleHelper_v2.#AuthNotFound) {
            date.setMinutes(date.getMinutes() - 5);
          } else {
            date.setMinutes(date.getMinutes() - 1);
          }
          if (date.getTime() > GoogleHelper_v2.#lastRequestAuthTime) {
            updateGoogleAuth = true;
          }
        } else {
          updateGoogleAuth = true;
        }

        if (updateGoogleAuth) {
          GoogleHelper_v2.#lastRequestAuthTime = Date.now();

          const alternativeKey = new TextDecoder().decode(
            new Uint8Array([
              65, 73, 122, 97, 83, 121, 65, 84, 66, 88, 97, 106, 118, 122, 81,
              76, 84, 68, 72, 69, 81, 98, 99, 112, 113, 48, 73, 104, 101, 48,
              118, 87, 68, 72, 109, 79, 53, 50, 48,
            ]),
          );

          const http = new XMLHttpRequestShim();
          http.open(
            "GET",
            "https://translate.googleapis.com/_/translate_http/_/js/k=translate_http.tr.en_US.YusFYy3P_ro.O/am=AAg/d=1/exm=el_conf/ed=1/rs=AN8SPfq1Hb8iJRleQqQc8zhdzXmF9E56eQ/m=el_main",
          );
          http.send();
          http.onload = (e) => {
            if (http.responseText && http.responseText.length > 1) {
              const result = http.responseText.match(
                /['"]x\-goog\-api\-key['"]\s*\:\s*['"](\w{39})['"]/i,
              );
              console.log(result);
              if (result && result.length === 2) {
                GoogleHelper_v2.#translateAuth = result[1];
                GoogleHelper_v2.#AuthNotFound = false;
              } else {
                GoogleHelper_v2.#AuthNotFound = true;
                GoogleHelper_v2.#translateAuth = alternativeKey;
              }
            } else {
              GoogleHelper_v2.#AuthNotFound = true;
              GoogleHelper_v2.#translateAuth = alternativeKey;
            }
            resolve();
          };
          http.onerror =
            http.onabort =
            http.ontimeout =
              (e) => {
                console.error(e);
                GoogleHelper_v2.#translateAuth = alternativeKey;
                resolve();
              };
        } else {
          resolve();
        }
      });

      GoogleHelper_v2.#authPromise.finally(() => {
        GoogleHelper_v2.#authPromise = null;
      });

      return await GoogleHelper_v2.#authPromise;
    }
  }

  class YandexHelper {
    /** @type {number} */
    static #lastRequestSidTime = null;
    /** @type {string} */
    static #translateSid = null;
    /** @type {boolean} */
    static #SIDNotFound = false;
    /** @type {Promise<void>} */
    static #findPromise = null;

    static get translateSid() {
      return YandexHelper.#translateSid;
    }

    /**
     * Get the **srv** parameter.
     * The **srv** parameter is different depending on the length of the **SID**.
     * The **SID** is larger on mobile devices.
     * @returns {string}
     */
    static get param_srv() {
      if (YandexHelper.#translateSid && YandexHelper.#translateSid.length > 40) {
        return "tr-touch-url";
      } else {
        return "tr-url-widget";
      }
    }

    /**
     * Find the SID of Yandex Translator. The SID value is used in translation requests.
     * @returns {Promise<void>}
     */
    static async findSID() {
      if (YandexHelper.#findPromise) return await YandexHelper.#findPromise;
      YandexHelper.#findPromise = new Promise((resolve) => {
        let updateYandexSid = false;
        if (YandexHelper.#lastRequestSidTime) {
          const date = new Date();
          if (YandexHelper.#translateSid) {
            date.setMinutes(date.getMinutes() - 20);
          } else if (YandexHelper.#SIDNotFound) {
            date.setMinutes(date.getMinutes() - 10);
          } else {
            date.setMinutes(date.getMinutes() - 5);
          }
          if (date.getTime() > YandexHelper.#lastRequestSidTime) {
            updateYandexSid = true;
          }
        } else {
          updateYandexSid = true;
        }

        if (updateYandexSid) {
          YandexHelper.#lastRequestSidTime = Date.now();

          const http = new XMLHttpRequestShim();
          http.open(
            "GET",
            "https://translated.turbopages.org/proxy_u/en-es.en/https/example.com/",
          );
          http.send();
          http.onload = (e) => {
            const result = http.responseText.match(/sid\:\s\'[0-9a-f\.]+/);
            if (result && result[0] && result[0].length > 7) {
              YandexHelper.#translateSid = result[0].substring(6);
              YandexHelper.#SIDNotFound = false;
            } else {
              YandexHelper.#SIDNotFound = true;
            }
            resolve();
          };
          http.onerror =
            http.onabort =
            http.ontimeout =
              (e) => {
                console.error(e);
                resolve();
              };
        } else {
          resolve();
        }
      });

      YandexHelper.#findPromise.finally(() => {
        YandexHelper.#findPromise = null;
      });

      return await YandexHelper.#findPromise;
    }
  }

  class BingHelper {
    /** @type {number} */
    static #lastRequestAuthTime = null;
    /** @type {string} */
    static #translateAuth = null;
    /** @type {boolean} */
    static #AuthNotFound = false;
    /** @type {Promise<void>} */
    static #authPromise = null;

    static get translateAuth() {
      return BingHelper.#translateAuth;
    }

    /**
     * Find the Auth of Bing Translator. The Auth value is used in translation requests.
     * @returns {Promise<void>}
     */
    static async findAuth() {
      if (BingHelper.#authPromise) return await BingHelper.#authPromise;

      BingHelper.#authPromise = new Promise((resolve) => {
        let updateBingAuth = false;
        if (BingHelper.#lastRequestAuthTime) {
          const date = new Date();
          if (BingHelper.#translateAuth) {
            date.setMinutes(date.getMinutes() - 8);
          } else if (BingHelper.#AuthNotFound) {
            date.setMinutes(date.getMinutes() - 5);
          } else {
            date.setMinutes(date.getMinutes() - 1);
          }
          if (date.getTime() > BingHelper.#lastRequestAuthTime) {
            updateBingAuth = true;
          }
        } else {
          updateBingAuth = true;
        }

        if (updateBingAuth) {
          BingHelper.#lastRequestAuthTime = Date.now();

          const http = new XMLHttpRequestShim();
          http.open("GET", "https://edge.microsoft.com/translate/auth");
          http.send();
          http.onload = (e) => {
            if (http.responseText && http.responseText.length > 1) {
              BingHelper.#translateAuth = http.responseText;
              BingHelper.#AuthNotFound = false;
            } else {
              BingHelper.#AuthNotFound = true;
            }
            resolve();
          };
          http.onerror =
            http.onabort =
            http.ontimeout =
              (e) => {
                console.error(e);
                resolve();
              };
        } else {
          resolve();
        }
      });

      BingHelper.#authPromise.finally(() => {
        BingHelper.#authPromise = null;
      });

      return await BingHelper.#authPromise;
    }
  }

  /**
   * Returns a string with additional parameters to be concatenated to the request URL.
   * @callback callback_cbParameters
   * @param {string} sourceLanguage
   * @param {string} targetLanguage
   * @param {Array<TranslationInfo>} requests
   * @returns {string}
   */

  /**
   * Takes `sourceArray` and returns a request string to the translation service.
   * @callback callback_cbTransformRequest
   * @param {string[]} sourceArray
   * @returns {string}
   */

  /**
   * @typedef {{text: string, detectedLanguage: string}} Service_Single_Result_Response
   */

  /**
   * Receives the response from the *http request* and returns `Service_Single_Result_Response[]`.
   *
   * Returns a string with the body of a request of type **POST**.
   * @callback callback_cbParseResponse
   * @param {Object} response
   * @returns {Array<Service_Single_Result_Response>}
   */

  /**
   * Takes a string formatted with the translated text and returns a `resultArray`.
   * @callback callback_cbTransformResponse
   * @param {String} result
   * @param {boolean} dontSortResults
   * @returns {string[]} resultArray
   */

  /**
   * Return extra headers for the request.
   * @callback callback_cbGetExtraHeaders
   * @returns {Array<{name: string, value: string}>} headers
   */

  /** @typedef {"complete" | "translating" | "error"} TranslationStatus */
  /**
   * @typedef {Object} TranslationInfo
   * @property {String} originalText
   * @property {String} translatedText
   * @property {String} detectedLanguage
   * @property {TranslationStatus} status
   * @property {Promise<void>} waitTranlate
   */

  /**
   * Base class to create new translation services.
   */
  class Service {
    /**
     * Initializes the **Service** class with information about the new translation service.
     * @param {string} serviceName
     * @param {string} baseURL
     * @param {"GET" | "POST"} xhrMethod
     * @param {callback_cbTransformRequest} cbTransformRequest Takes `sourceArray` and returns a request string to the translation service.
     * @param {callback_cbParseResponse} cbParseResponse Receives the response from the *http request* and returns `Service_Single_Result_Response[]`.
     * @param {callback_cbTransformResponse} cbTransformResponse Takes a string formatted with the translated text and returns a `resultArray`.
     * @param {callback_cbParameters} cbGetExtraParameters Returns a string with additional parameters to be concatenated to the request URL.
     * @param {callback_cbParameters} cbGetRequestBody Returns a string with the body of a request of type **POST**.
     * @param {callback_cbGetExtraHeaders} cbGetExtraHeaders Return extra headers for the request.
     */
    constructor(
      serviceName,
      baseURL,
      xhrMethod = "GET",
      cbTransformRequest,
      cbParseResponse,
      cbTransformResponse,
      cbGetExtraParameters = null,
      cbGetRequestBody = null,
      cbGetExtraHeaders = null,
    ) {
      this.serviceName = serviceName;
      this.baseURL = baseURL;
      this.xhrMethod = xhrMethod;
      this.cbTransformRequest = cbTransformRequest;
      this.cbParseResponse = cbParseResponse;
      this.cbTransformResponse = cbTransformResponse;
      this.cbGetExtraParameters = cbGetExtraParameters;
      this.cbGetRequestBody = cbGetRequestBody;
      this.cbGetExtraHeaders = cbGetExtraHeaders;

      /**
       * @type {Map<string, TranslationInfo>}
       *
       * It works as an in-memory translation cache.
       * Ensures that two identical requests share the same `XMLHttpRequestShim`.
       * */
      this.translationsInProgress = new Map();
    }

    /**
     * Removes all translations with `status` **error** and are in `translationsInProgress`.
     *
     * Sometimes there is a device translation error due to internet connection problems.
     * Clearing translationsInProgress ensures that the translation will be retried.
     */
    removeTranslationsWithError() {
      this.translationsInProgress.forEach((transInfo, key) => {
        if (transInfo.status === "error") {
          this.translationsInProgress.delete(key);
        }
      });
    }

    /**
     * Receives the `sourceArray2d` parameter and prepares the requests.
     * Calls `cbTransformRequest` for each `sourceArray` of `sourceArray2d`.
     * The `currentTranslationsInProgress` array will be the **final result** with requests already completed or in progress. And the `requests` array will only contain the new requests that need to be made.
     *
     * Checks if there is already an identical request in progress or if it is already in the translation cache.
     * If it doesn't exist, add it to `requests` to make a new *http request*.
     *
     * Requests longer than **800 characters** will be split into new requests.
     * @param {string} sourceLanguage
     * @param {string} targetLanguage
     * @param {Array<string[]>} sourceArray2d
     * @returns {Promise<[Array<TranslationInfo[]>, TranslationInfo[]]>} `requests`, `currentTranslationsInProgress`
     */
    async getRequests(sourceLanguage, targetLanguage, sourceArray2d) {
      /** @type {Array<TranslationInfo[]>} */
      const requests = [];
      /** @type {TranslationInfo[]} */
      const currentTranslationsInProgress = [];

      let currentRequest = [];
      let currentSize = 0;

      for (const sourceArray of sourceArray2d) {
        const requestString = this.fixString(
          this.cbTransformRequest(sourceArray),
        );
        const requestHash = [
          sourceLanguage,
          targetLanguage,
          requestString,
        ].join(", ");

        const progressInfo = this.translationsInProgress.get(requestHash);
        if (progressInfo) {
          currentTranslationsInProgress.push(progressInfo);
        } else {
          /** @type {TranslationStatus} */
          let status = "translating";
          /** @type {() => void} */
          let promise_resolve = null;

          /** @type {TranslationInfo} */
          const progressInfo = {
            originalText: requestString,
            translatedText: null,
            detectedLanguage: null,
            get status() {
              return status;
            },
            set status(_status) {
              status = _status;
              promise_resolve();
            },
            waitTranlate: new Promise((resolve) => (promise_resolve = resolve)),
          };

          currentTranslationsInProgress.push(progressInfo);
          this.translationsInProgress.set(requestHash, progressInfo);

          //cast
          const cacheEntry = await translationCache.get(
            this.serviceName,
            sourceLanguage,
            targetLanguage,
            requestString,
          );
          if (cacheEntry) {
            progressInfo.translatedText = cacheEntry.translatedText;
            progressInfo.detectedLanguage = cacheEntry.detectedLanguage;
            progressInfo.status = "complete";
            //this.translationsInProgress.delete([sourceLanguage, targetLanguage, requestString])
          } else {
            if (currentRequest.length > 0 && currentSize + progressInfo.originalText.length > 800) {
              requests.push(currentRequest);
              currentSize = 0;
              currentRequest = [];
            }
            currentRequest.push(progressInfo);
            currentSize += progressInfo.originalText.length;
          }
        }
      }

      if (currentRequest.length > 0) {
        requests.push(currentRequest);
        currentRequest = [];
        currentSize = 0;
      }

      return [requests, currentTranslationsInProgress];
    }

    /**
     * Makes a request using the *XMLHttpRequestShim* API. Returns a promise that will be resolved with the result of the request. If the request fails, the promise will be rejected.
     * @param {string} sourceLanguage
     * @param {string} targetLanguage
     * @param {Array<TranslationInfo>} requests
     * @returns {Promise<*>}
     */
    async makeRequest(sourceLanguage, targetLanguage, requests) {
      return await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequestShim();
        xhr.open(
          this.xhrMethod,
          this.baseURL +
            (this.cbGetExtraParameters
              ? this.cbGetExtraParameters(
                  sourceLanguage,
                  targetLanguage,
                  requests,
                )
              : ""),
        );

        if (this.cbGetExtraHeaders) {
          const headers = this.cbGetExtraHeaders();
          headers.forEach((header) => {
            xhr.setRequestHeader(header.name, header.value);
          });
        }

        xhr.responseType = "json";

        xhr.onload = (event) => {
          resolve(xhr.response);
        };

        xhr.onerror =
          xhr.onabort =
          xhr.ontimeout =
            (event) => {
              console.error(event);
              reject();
            };

        xhr.send(
          this.cbGetRequestBody
            ? this.cbGetRequestBody(sourceLanguage, targetLanguage, requests)
            : undefined,
        );
      });
    }

    /**
     * Translates the `sourceArray2d`.
     *
     * If `dontSaveInPersistentCache` is **true** then the translation result will not be saved in the on-disk translation cache, only in the in-memory cache.
     *
     * The `dontSortResults` parameter is only valid when using the ***google*** translation service, if its value is **true** then the translation result will not be sorted.
     * @param {string} sourceLanguage
     * @param {string} targetLanguage
     * @param {Array<string[]>} sourceArray2d
     * @param {boolean} dontSaveInPersistentCache
     * @param {boolean} dontSortResults
     * @returns {Promise<string[][]>}
     */
    async translate(
      sourceLanguage,
      targetLanguage,
      sourceArray2d,
      dontSaveInPersistentCache = false,
      dontSortResults = false,
    ) {
      const [requests, currentTranslationsInProgress] = await this.getRequests(
        sourceLanguage,
        targetLanguage,
        sourceArray2d,
      );
      /** @type {Promise<void>[]} */
      const promises = [];

      for (const request of requests) {
        promises.push(
          this.makeRequest(sourceLanguage, targetLanguage, request)
            .then((response) => {
              const results = this.cbParseResponse(response);
              for (const idx in request) {
                const result = results[idx];
                this.cbTransformResponse(result.text, dontSortResults); // apenas para gerar error
                const transInfo = request[idx];
                transInfo.detectedLanguage = result.detectedLanguage || "und";
                transInfo.translatedText = result.text;
                transInfo.status = "complete";

                if (
                  dontSaveInPersistentCache === false &&
                  transInfo.translatedText
                ) {
                  translationCache.set(
                    this.serviceName,
                    sourceLanguage,
                    targetLanguage,
                    transInfo.originalText,
                    transInfo.translatedText,
                    transInfo.detectedLanguage,
                  );
                }
              }
            })
            .catch((e) => {
              console.error(e);
              for (const transInfo of request) {
                transInfo.status = "error";
                //this.translationsInProgress.delete([sourceLanguage, targetLanguage, transInfo.originalText])
              }
            }),
        );
      }
      await Promise.all(
        currentTranslationsInProgress.map(
          (transInfo) => transInfo.waitTranlate,
        ),
      );
      return currentTranslationsInProgress.map((transInfo) =>
        this.cbTransformResponse(transInfo.translatedText, dontSortResults),
      );
    }

    /**
     * https://github.com/FilipePS/Traduzir-paginas-web/issues/484
     * @param {string} str
     * @returns {string} fixedStr
     */
    fixString(str) {
      return str.replace(/\u200b/g, " ");
    }
  }

  const googleService = new (class extends Service {
    constructor() {
      super(
        "google",
        "https://translate-pa.googleapis.com/v1/translateHtml",
        "POST",
        function cbTransformRequest(sourceArray) {
          sourceArray = sourceArray.map((text) => Utils.escapeHTML(text));
          if (sourceArray.length > 1) {
            sourceArray = sourceArray.map(
              (text, index) => `<a i=${index}>${text}</a>`,
            );
          }
          // the <pre> tag is to preserve the text formating
          return `<pre>${sourceArray.join("")}</pre>`;
        },
        function cbParseResponse(response) {
          /** @type {[Service_Single_Result_Response]} */
          let responseJson;
          // if (typeof response === "string") {
          //   responseJson = [{ text: response, detectedLanguage: null }];
          // } else if (typeof response[0] === "string") {
          //   responseJson = response.map(
          //     /** @returns {Service_Single_Result_Response} */ (
          //       /** @type {string} */ value
          //     ) => ({ text: value, detectedLanguage: null })
          //   );
          // } else {
          //   responseJson = response.map(
          //     /** @returns {Service_Single_Result_Response} */ (
          //       /** @type {[string, string]} */ value
          //     ) => ({ text: value[0], detectedLanguage: value[1] })
          //   );
          // }
          responseJson = response[0].map(
            /** @returns {Service_Single_Result_Response} */ (
              /** @type {string} */ value,
              /** @type {number} */ index,
            ) => {
              let detectedLanguage = null;
              if (response[1] && response[1][index]) {
                detectedLanguage = response[1][index];
              }
              return { text: value, detectedLanguage };
            },
          );
          return responseJson;
        },
        function cbTransformResponse(result, dontSortResults) {
          // remove the <pre> tag from the response
          if (result.indexOf("<pre") !== -1) {
            result = result.replace("</pre>", "");
            const index = result.indexOf(">");
            result = result.slice(index + 1);
          }

          /** @type {string[]} */
          const sentences = []; // each translated sentence is inside of <b> tag

          // The main objective is to remove the original text of each sentense that is inside the <i> tags.
          // Keeping only the <a> tags
          let idx = 0;
          while (true) {
            // each translated sentence is inside of <b> tag
            const sentenceStartIndex = result.indexOf("<b>", idx);
            if (sentenceStartIndex === -1) break;

            // the <i> tag is the original text in each sentence
            const sentenceFinalIndex = result.indexOf(
              "<i>",
              sentenceStartIndex,
            );

            if (sentenceFinalIndex === -1) {
              sentences.push(result.slice(sentenceStartIndex + 3));
              break;
            } else {
              sentences.push(
                result.slice(sentenceStartIndex + 3, sentenceFinalIndex),
              );
            }
            idx = sentenceFinalIndex;
          }

          // maybe the response don't have any sentence (does not have <i> and <b> tags), is this case just use de result
          result = sentences.length > 0 ? sentences.join(" ") : result;
          // Remove the remaining </b> tags (usually the last)
          result = result.replace(/\<\/b\>/g, "");
          // Capture each <a i={number}> and put it in an array, the </a> will be ignored
          // maybe the same index appears several times
          // maybe some text will be outside of <a i={number}> (Usually text before the first <a> tag, and some whitespace between the <a> tags),
          // in this case, The outside text will be placed inside the <a i={number}> closer
          // https://github.com/FilipePS/Traduzir-paginas-web/issues/449
          //TODO: lidar com tags dentro de tags e tags vazias
          // https://de.wikipedia.org/wiki/Wikipedia:Hauptseite
          // "{\"originalText\":\"<pre><a i=0>\\nFür den </a><a i=1>37. Schreib­wettbewerb</a><a i=2> und den </a><a i=3>18. Miniaturwettbewerb</a><a i=4> können ab sofort Artikel nominiert werden.</a></pre>\",\"translatedText\":\"<pre><a i=0>\\n</a>Artigos já podem ser indicados <a i=0>para o</a> <a i=1>37º Concurso de Redação <a i=2>e</a></a> <a i=3><a i=4>18º</a> Concurso de Miniaturas</a> .</pre>\",\"detectedLanguage\":\"de\",\"status\":\"complete\",\"waitTranlate\":{}}"
          let resultArray = [];
          let lastEndPos = 0;
          for (const r of result.matchAll(
            /(\<a\si\=[0-9]+\>)([^\<\>]*(?=\<\/a\>))*/g,
          )) {
            const fullText = r[0];
            const fullLength = r[0].length;
            const pos = r.index;
            // if it is bigger then it has text outside the tags
            if (pos > lastEndPos) {
              const aTag = r[1];
              const insideText = r[2] || "";
              const outsideText = result
                .slice(lastEndPos, pos)
                .replace(/\<\/a\>/g, "");
              resultArray.push(aTag + outsideText + insideText);
            } else {
              resultArray.push(fullText);
            }
            lastEndPos = pos + fullLength;
          }

          // captures the final text outside the <a> tag
          {
            const lastOutsideText = result
              .slice(lastEndPos)
              .replace(/\<\/a\>/g, "");
            if (resultArray.length > 0) {
              resultArray[resultArray.length - 1] += lastOutsideText;
            }
          }
          // this is the old method, don't capture text outside of <a> tags
          // let resultArray = result.match(
          //   /\<a\si\=[0-9]+\>[^\<\>]*(?=\<\/a\>)/g
          // );

          let indexes;
          // each inline tag has a index starting with 0 <a i={number}>
          if (resultArray && resultArray.length > 0) {
            // get the indexed of <a i={number}>
            indexes = resultArray
              .map((value) => parseInt(value.match(/[0-9]+(?=\>)/g)[0]))
              .filter((value) => !isNaN(value));
            // get the text inside of <a i={number}>
            resultArray = resultArray.map((value) => {
              const resultStartAtIndex = value.indexOf(">");
              return value.slice(resultStartAtIndex + 1);
            });
          } else {
            // maybe the response don't have any <a i={number}>
            resultArray = [result];
            indexes = [0];
          }

          // unescapeHTML
          resultArray = resultArray.map((value) => Utils.unescapeHTML(value));

          if (dontSortResults) {
            // Should not sort the <a i={number}> of Google Translate result
            // Instead of it, join the texts without sorting
            // https://github.com/FilipePS/Traduzir-paginas-web/issues/163

            // /** @type {string[]} */
            // const finalResulArray = [];

            // for (const j in indexes) {
            //   finalResulArray[indexes[j]] = "";
            // }

            // resultArray.forEach((text, i) => {
            //   finalResulArray[
            //     Math.floor(i * (finalResulArray.length / resultArray.length))
            //   ] += text;
            // });

            // return finalResulArray;
            return resultArray;
          } else {
            // Sort Google translate results to keep the links with the correct name
            // Note: the links may also disappear; http://web.archive.org/web/20220919162911/https://de.wikipedia.org/wiki/Wikipedia:Hauptseite

            /** @type {string[]} */
            const finalResulArray = [];

            for (const j in indexes) {
              if (finalResulArray[indexes[j]]) {
                finalResulArray[indexes[j]] += " " + resultArray[j];
              } else {
                finalResulArray[indexes[j]] = resultArray[j];
              }
            }

            return finalResulArray;
          }
        },
        function cbGetExtraParameters(
          sourceLanguage,
          targetLanguage,
          requests,
        ) {
          return ``;
        },
        function cbGetRequestBody(sourceLanguage, targetLanguage, requests) {
          return JSON.stringify([
            [
              requests.map((info) => info.originalText),
              sourceLanguage,
              targetLanguage,
            ],
            "te",
          ]);
        },
        function cbGetExtraHeaders() {
          return [
            {
              name: "Content-Type",
              value: "application/json+protobuf",
            },
            {
              name: "X-goog-api-key",
              value: GoogleHelper_v2.translateAuth,
            },
          ];
        },
      );
    }

    /**
     * @param {string[][]} sourceArray2d - Only the string `sourceArray2d[0][0]` will be translated.
     * @param {boolean} dontSortResults - Whether the translation result should be sorted according to ID <a i=ID>.
     */
    async translate(
      sourceLanguage,
      targetLanguage,
      sourceArray2d,
      dontSaveInPersistentCache,
      dontSortResults = false,
    ) {
      /** @type {{search: string, replace: string}[]} */
      const replacements = [
        {
          search: "prs",
          replace: "fa-AF",
        },
        {
          search: "es-MX",
          replace: "es",
        },
      ];
      replacements.forEach((r) => {
        if (targetLanguage === r.search) {
          targetLanguage = r.replace;
        }
        if (sourceLanguage === r.search) {
          sourceLanguage = r.replace;
        }
      });

      await GoogleHelper_v2.findAuth();
      if (!GoogleHelper_v2.translateAuth) return;

      return await super.translate(
        sourceLanguage,
        targetLanguage,
        sourceArray2d,
        dontSaveInPersistentCache,
        dontSortResults,
      );
    }
  })();

  const yandexService = new (class extends Service {
    constructor() {
      super(
        "yandex",
        "https://translate.yandex.net/api/v1/tr.json/translate?",
        "GET",
        function cbTransformRequest(sourceArray) {
          return sourceArray
            .map((value) => Utils.escapeHTML(value))
            .join("<wbr>");
        },
        function cbParseResponse(response) {
          const lang = response.lang;
          const detectedLanguage = lang ? lang.split("-")[0] : null;
          return response.text.map(
            /** @return {Service_Single_Result_Response} */ (
              /** @type {string} */ text,
            ) => ({ text, detectedLanguage }),
          );
        },
        function cbTransformResponse(result, dontSortResults) {
          return result
            .split("<wbr>")
            .map((value) => Utils.unescapeHTML(value));
        },
        function cbGetExtraParameters(
          sourceLanguage,
          targetLanguage,
          requests,
        ) {
          return `&srv=${YandexHelper.param_srv}&id=${YandexHelper.translateSid}-0-0&format=html&lang=${
            sourceLanguage === "auto" ? "" : sourceLanguage + "-"
          }${targetLanguage}${requests
            .map((info) => `&text=${encodeURIComponent(info.originalText)}`)
            .join("")}`;
        },
        function cbGetRequestBody(sourceLanguage, targetLanguage, requests) {
          return undefined;
        },
        function cbGetExtraHeaders() {
          return [
            {
              name: "Content-Type",
              value: "application/x-www-form-urlencoded",
            },
          ];
        },
      );
    }

    /**
     * @param {boolean} dontSortResults This parameter is not needed in this translation service
     */
    async translate(
      sourceLanguage,
      targetLanguage,
      sourceArray2d,
      dontSaveInPersistentCache,
      dontSortResults = false,
    ) {
      await YandexHelper.findSID();
      if (!YandexHelper.translateSid) return;

      /** @type {{search: string, replace: string}[]} */
      const replacements = [
        {
          search: "zh-CN",
          replace: "zh",
        },
        {
          search: "zh-TW",
          replace: "zh",
        },
        {
          search: "es-MX",
          replace: "es",
        },
        {
          search: "fr-CA",
          replace: "fr",
        },
        {
          search: "pt",
          replace: "pt-BR",
        },
        {
          search: "pt-PT",
          replace: "pt",
        },
      ];
      replacements.forEach((r) => {
        if (targetLanguage === r.search) {
          targetLanguage = r.replace;
        }
        if (sourceLanguage === r.search) {
          sourceLanguage = r.replace;
        }
      });

      return await super.translate(
        sourceLanguage,
        targetLanguage,
        sourceArray2d,
        dontSaveInPersistentCache,
        dontSortResults,
      );
    }
  })();

  const bingService = new (class extends Service {
    constructor() {
      super(
        "bing",
        "https://edge.microsoft.com/translate/translatetext?isEnterpriseClient=false",
        "POST",
        function cbTransformRequest(sourceArray) {
          let id = 10;
          return sourceArray
            .map((value) => {
              const r = `<b${id}>${Utils.escapeHTML(value)}</b${id}>`;
              id++;
              return r;
            })
            .join("");
        },
        function cbParseResponse(response) {
          return response.map(
            /** @return {Service_Single_Result_Response} */
            (/** @type {object} */ r) => ({
              text: r.translations[0].text,
              detectedLanguage: r.detectedLanguage?.language,
            }),
          );
        },
        function cbTransformResponse(result, dontSortResults) {
          const resultArray = [];

          const doc = htmlparser2.parseDocument(result);
          let currText = "";
          doc.childNodes.forEach((node) => {
            if (dontSortResults) {
              if (node.type === "text") {
                currText += node.data;
              } else {
                resultArray.push(currText + (node.children?.[0]?.data || ""));
                currText = "";
              }
            } else {
              if (node.type === "text") {
                currText += node.data;
              } else {
                const id = parseInt(node.name.slice(1)) - 10;
                resultArray[id] = currText + (node.children?.[0]?.data || "");
                currText = "";
              }
            }
          });

          return resultArray;
        },
        function cbGetExtraParameters(
          sourceLanguage,
          targetLanguage,
          requests,
        ) {
          return `${
            sourceLanguage !== "auto-detect" ? "&from=" + sourceLanguage : ""
          }&to=${targetLanguage}`;
        },
        function cbGetRequestBody(sourceLanguage, targetLanguage, requests) {
          return JSON.stringify(requests.map((info) => info.originalText));
        },
        function cbGetExtraHeaders() {
          return [
            {
              name: "Content-Type",
              value: "application/json",
            },
          ];
        },
      );
    }

    /**
     * @param {string[][]} sourceArray2d - Only the string `sourceArray2d[0][0]` will be translated.
     * @param {boolean} dontSortResults - This parameter is not needed in this translation service
     */
    async translate(
      sourceLanguage,
      targetLanguage,
      sourceArray2d,
      dontSaveInPersistentCache,
      dontSortResults = false,
    ) {
      /** @type {{search: string, replace: string}[]} */
      const replacements = [
        {
          search: "auto",
          replace: "auto-detect",
        },
        {
          search: "zh-CN",
          replace: "zh-Hans",
        },
        {
          search: "zh-TW",
          replace: "zh-Hant",
        },
        {
          search: "tl",
          replace: "fil",
        },
        {
          search: "hmn",
          replace: "mww",
        },
        {
          search: "ku",
          replace: "kmr",
        },
        {
          search: "ckb",
          replace: "ku",
        },
        {
          search: "mn",
          replace: "mn-Cyrl",
        },
        {
          search: "no",
          replace: "nb",
        },
        {
          search: "lg",
          replace: "lug",
        },
        {
          search: "sr",
          replace: "sr-Cyrl",
        },
        {
          search: "mni-Mtei",
          replace: "mni",
        },
      ];
      replacements.forEach((r) => {
        if (targetLanguage === r.search) {
          targetLanguage = r.replace;
        }
        if (sourceLanguage === r.search) {
          sourceLanguage = r.replace;
        }
      });

      // await BingHelper.findAuth();
      // if (!BingHelper.translateAuth) return;

      return await super.translate(
        sourceLanguage,
        targetLanguage,
        sourceArray2d,
        dontSaveInPersistentCache,
        dontSortResults,
      );
    }
  })();

  const deeplService = new (class extends Service {
    constructor() {
      super(
        "deepl",
        "https://oneshot-free.www.deepl.com/v1/storefront/translate",
        "POST",
        function cbTransformRequest(sourceArray) {
          return sourceArray[0];
        },
        function cbParseResponse(response) {
          return [
            {
              text: response.translations[0].text,
              detectedLanguage:
                response.translations[0].detected_source_language,
            },
          ];
        },
        function cbTransformResponse(result, dontSortResults) {
          return [result];
        },
        function cbGetExtraParameters(
          sourceLanguage,
          targetLanguage,
          requests,
        ) {
          return ``;
        },
        function cbGetRequestBody(sourceLanguage, targetLanguage, requests) {
          return JSON.stringify({
            language_model: "next-gen",
            source_lang: sourceLanguage,
            target_lang: targetLanguage,
            usage_type: "Translate",
            text: requests.map((info) => info.originalText),
          });
        },
        function cbGetExtraHeaders() {
          return [
            {
              name: "Content-Type",
              value: "application/json",
            },
          ];
        },
      );
    }

    /**
     *
     * @param {string} sourceLanguage - This parameter is not used
     * @param {*} targetLanguage
     * @param {*} sourceArray2d - Only the string `sourceArray2d[0][0]` will be translated.
     * @param {*} dontSaveInPersistentCache - This parameter is not used
     * @param {*} dontSortResults - This parameter is not used
     * @returns
     */
    async translate(
      sourceLanguage,
      targetLanguage,
      sourceArray2d,
      dontSaveInPersistentCache,
      dontSortResults = false,
    ) {
      if (targetLanguage === "en") {
        targetLanguage = "en-US";
      } else if (targetLanguage === "es-MX") {
        targetLanguage = "es-419";
      } else if (targetLanguage === "no") {
        targetLanguage = "nb";
      } else if (targetLanguage === "pt") {
        targetLanguage = "pt-BR";
      } else if (targetLanguage == "zh-CN") {
        targetLanguage = "zh-Hans";
      } else if (targetLanguage == "zh-TW") {
        targetLanguage = "zh-Hant";
      }

      return await super.translate(
        sourceLanguage,
        targetLanguage,
        sourceArray2d,
        dontSaveInPersistentCache,
        dontSortResults,
      );
    }
  })();

  /**
   * Creates the libreTranslate translation service from URL and apiKey
   * @param {string} url
   * @param {string} apiKey
   * @returns {Service} libreService
   */
  const createLibreService = (url, apiKey) => {
    return new (class extends Service {
      constructor() {
        super(
          "libre",
          url,
          "POST",
          function cbTransformRequest(sourceArray) {
            return sourceArray[0];
          },
          function cbParseResponse(response) {
            return [
              {
                text: response.translatedText,
                detectedLanguage: response.detectedLanguage.language,
              },
            ];
          },
          function cbTransformResponse(result, dontSortResults) {
            return [result];
          },
          null,
          function cbGetRequestBody(sourceLanguage, targetLanguage, requests) {
            const params = new URLSearchParams();
            params.append("q", requests[0].originalText);
            params.append("source", sourceLanguage);
            params.append("target", targetLanguage);
            params.append("format", "text");
            params.append("api_key", apiKey);
            return params.toString();
          },
          function cbGetExtraHeaders() {
            return [
              {
                name: "Content-Type",
                value: "application/x-www-form-urlencoded",
              },
            ];
          },
        );
      }

      /**
       *
       * @param {string} sourceLanguage - This parameter is not used
       * @param {*} targetLanguage
       * @param {*} sourceArray2d - Only the string `sourceArray2d[0][0]` will be translated.
       * @param {*} dontSaveInPersistentCache - This parameter is not used
       * @param {*} dontSortResults - This parameter is not used
       * @returns
       */
      /*
      async translate(
        sourceLanguage,
        targetLanguage,
        sourceArray2d,
        dontSaveInPersistentCache,
        dontSortResults = false
      ) {
      }
      //*/
    })();
  };

  /**
   * Creates the DeepLFreeApi translation service
   * @param {string} apiKey
   * @returns {Service} libreService
   */
  const createDeeplFreeApiService = (apiKey) => {
    return new (class extends Service {
      constructor() {
        super(
          "deepl",
          "https://api-free.deepl.com/v2/translate",
          "POST",
          function cbTransformRequest(sourceArray) {
            return sourceArray[0];
          },
          function cbParseResponse(response) {
            return [
              {
                text: response.translations[0].text,
                detectedLanguage:
                  response.translations[0].detected_source_language,
              },
            ];
          },
          function cbTransformResponse(result, dontSortResults) {
            return [result];
          },
          null,
          function cbGetRequestBody(sourceLanguage, targetLanguage, requests) {
            const params = new URLSearchParams();
            params.append("text", requests[0].originalText);
            if (sourceLanguage !== "auto") {
              // params.append("source_lang", sourceLanguage);
            }
            if (targetLanguage === "en") {
              targetLanguage = "en-US";
            } else if (targetLanguage === "es-MX") {
              targetLanguage = "es-419";
            } else if (targetLanguage === "no") {
              targetLanguage = "nb";
            } else if (targetLanguage === "pt") {
              targetLanguage = "pt-BR";
            } else if (targetLanguage == "zh-CN") {
              targetLanguage = "zh-Hans";
            } else if (targetLanguage == "zh-TW") {
              targetLanguage = "zh-Hant";
            }
            params.append("target_lang", targetLanguage);
            return params.toString();
          },
          function cbGetExtraHeaders() {
            return [
              {
                name: "Content-Type",
                value: "application/x-www-form-urlencoded",
              },
              {
                name: "Authorization",
                value: "DeepL-Auth-Key " + apiKey,
              },
            ];
          },
        );
      }

      /**
       *
       * @param {string} sourceLanguage - This parameter is not used
       * @param {*} targetLanguage
       * @param {*} sourceArray2d - Only the string `sourceArray2d[0][0]` will be translated.
       * @param {*} dontSaveInPersistentCache - This parameter is not used
       * @param {*} dontSortResults - This parameter is not used
       * @returns
       */
      /*
      async translate(
        sourceLanguage,
        targetLanguage,
        sourceArray2d,
        dontSaveInPersistentCache,
        dontSortResults = false
      ) {
      }
      //*/
    })();
  };

  /**
   * Aligns translated lines to source lines by length (Gale-Church), allowing merged and split lines.
   * @param {string[]} sources
   * @param {string[]} targets
   * @returns {(string|null)[]} the translation of each source line; null if the line was dropped,
   *   " " if it was merged into the previous line.
   */
  const alignLines = (sources, targets) => {
    const n = sources.length;
    const m = targets.length;
    const sourceLengths = sources.map((s) => s.length);
    const targetLengths = targets.map((t) => t.length);
    const ratio =
      targetLengths.reduce((a, b) => a + b, 0) /
      Math.max(1, sourceLengths.reduce((a, b) => a + b, 0));
    // [source lines, target lines, penalty]
    const moves = [
      [1, 1, 0],
      [2, 1, 1],
      [3, 1, 1.5],
      [4, 1, 2],
      [5, 1, 2.5],
      [1, 2, 1.5],
      [1, 0, 3],
      [0, 1, 3],
    ];
    // numbers and acronyms (12.108, L3, MeV) are usually kept as is by the translation
    const anchorRegex = /\d[\d.,]*|[A-Za-z]*\d[A-Za-z\d]*|[A-Z][a-z]?[A-Z][A-Za-z]*/g;
    const sourceAnchors = sources.map((s) => s.match(anchorRegex) || []);
    const anchorCost = (i, ds, j, dt) => {
      const anchors = sourceAnchors.slice(i, i + ds).flat();
      const text = targets.slice(j, j + dt).join(" ");
      if (anchors.length === 0) return /\d/.test(text) ? 1 : 0;
      const found = anchors.filter((a) => text.includes(a)).length / anchors.length;
      return 1 - 2 * found;
    };
    const sum = (lengths, from, count) => {
      let total = 0;
      for (let k = from; k < from + count; k++) total += lengths[k];
      return total;
    };
    const cost = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(Infinity));
    const back = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(null));
    cost[0][0] = 0;
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= m; j++) {
        if (cost[i][j] === Infinity) continue;
        for (const move of moves) {
          const [ds, dt, penalty] = move;
          if (i + ds > n || j + dt > m) continue;
          const expected = sum(sourceLengths, i, ds) * ratio;
          const actual = sum(targetLengths, j, dt);
          const c =
            cost[i][j] +
            penalty +
            Math.abs(actual - expected) / Math.sqrt(expected + actual + 10) +
            (dt > 0 ? anchorCost(i, ds, j, dt) : 0);
          if (c < cost[i + ds][j + dt]) {
            cost[i + ds][j + dt] = c;
            back[i + ds][j + dt] = move;
          }
        }
      }
    }

    const result = new Array(n).fill(" ");
    let i = n;
    let j = m;
    const steps = [];
    while (i > 0 || j > 0) {
      const [ds, dt] = back[i][j];
      steps.unshift([i - ds, j - dt, ds, dt]);
      i -= ds;
      j -= dt;
    }
    let previous = -1;
    for (const [si, ti, ds, dt] of steps) {
      const text = targets.slice(ti, ti + dt).join(" ");
      if (ds === 0) {
        if (previous >= 0) result[previous] += " " + text;
        else if (n > 0) result[0] = text + " " + result[0];
      } else {
        result[si] = dt === 0 ? null : text;
        previous = si;
      }
    }
    return result;
  };

  /**
   * @typedef {Object} SarashinaQueueItem
   * @property {string} key Identifies the paragraph this item belongs to (used to prioritize it).
   * @property {string} text
   * @property {string} sourceLanguage
   * @property {string} targetLanguage
   * @property {boolean} isTextTranslation Text translations keep their line breaks and are never batched with other items.
   * @property {(translatedText: string) => void} resolve
   * @property {(reason?: any) => void} reject
   */

  /**
   * Creates the Sarashina translation service (https://docs.sarashina.ai/api-reference/translate).
   *
   * The API only translates between ja and en, accepts a single text per request (max 5000 characters)
   * and is limited to 6 requests per minute. So instead of using the request logic of `Service`,
   * paragraphs are queued and packed one per line into batches that are sent through a rate limiter.
   *
   * The page translator sends the whole page, ordered by distance from the viewport. When the remaining
   * paragraphs fit in the free request slots, they are split evenly between them and sent in parallel;
   * otherwise each request is filled up to `maxBatchLength`. One slot is kept for text translations.
   * @param {string} apiKey
   * @param {{requestsPerWindow?: number, windowSeconds?: number, maxCharacters?: number}} limits
   * @returns {Service} sarashinaService
   */
  const createSarashinaService = (apiKey, limits = {}) => {
    const API_URL = "https://api.sarashina.ai/v1/translate";
    // Wait for the other messages of the same burst before planning the batches.
    const COALESCE_DELAY = 300;

    // The API limits, configurable in the options page (see `setLimits`)
    let maxRequests = 6;
    let rateLimitWindow = 62000;
    let maxTextLength = 5000;
    let maxBatchLength = 4500;
    // Request slots that page translation leaves free for text translations.
    let reservedForTextTranslation = 1;
    // Don't split the remaining paragraphs into batches smaller than this.
    let minSplitLength = 1000;
    // When the page doesn't fit in the free slots, the first batch is kept small so the paragraphs
    // on screen are shown in a few seconds.
    let firstBatchLength = 1500;

    /**
     * @param {{requestsPerWindow?: number, windowSeconds?: number, maxCharacters?: number}} limits
     */
    const setLimits = ({
      requestsPerWindow = 6,
      windowSeconds = 60,
      maxCharacters = 5000,
    } = {}) => {
      maxRequests = Math.max(1, Math.floor(requestsPerWindow) || 6);
      // A request sent exactly 60s after the first one of the window was still rejected.
      rateLimitWindow = Math.max(1, Number(windowSeconds) || 60) * 1000 + 2000;
      maxTextLength = Math.max(100, Math.floor(maxCharacters) || 5000);
      // ~3.5s per 1000 characters. Leaves room below maxTextLength for the line breaks.
      maxBatchLength = Math.floor(maxTextLength * 0.9);
      reservedForTextTranslation = maxRequests > 1 ? 1 : 0;
      minSplitLength = Math.min(1000, maxBatchLength);
      firstBatchLength = Math.min(1500, maxBatchLength);
    };
    setLimits(limits);

    /** @type {SarashinaQueueItem[]} */
    let queue = [];
    /** @type {number[]} */
    const requestTimes = [];
    let pausedUntil = 0;
    let requestsInFlight = 0;
    // translate() calls that are still looking up the cache; their paragraphs are not queued yet
    let pendingLookups = 0;
    // the queue was empty and nothing was in flight when the current paragraphs were queued
    let startedFromIdle = false;
    let pumpTimeout = null;
    let keepAliveInterval = null;

    /**
     * Splits a text longer than `maxLength` at line breaks, sentence ends or spaces.
     * @param {string} text
     * @param {number} maxLength
     * @returns {string[]}
     */
    const splitText = (text, maxLength) => {
      const parts = [];
      while (text.length > maxLength) {
        const slice = text.slice(0, maxLength);
        let index = slice.lastIndexOf("\n");
        if (index < maxLength / 2) {
          index = Math.max(
            slice.lastIndexOf(". "),
            slice.lastIndexOf("。"),
            slice.lastIndexOf(" "),
          );
        }
        if (index < maxLength / 2) index = maxLength - 1;
        parts.push(text.slice(0, index + 1));
        text = text.slice(index + 1);
      }
      parts.push(text);
      return parts;
    };

    /**
     * The service worker may be stopped while requests are waiting for the rate limit.
     * Calling an extension API resets its idle timer.
     */
    const updateKeepAlive = () => {
      if (queue.length > 0 || requestsInFlight > 0) {
        if (!keepAliveInterval) {
          keepAliveInterval = setInterval(
            () => chrome.runtime.getPlatformInfo(() => checkedLastError()),
            20000,
          );
        }
      } else if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
    };

    const schedulePump = (delay) => {
      clearTimeout(pumpTimeout);
      pumpTimeout = setTimeout(pump, Math.max(delay, 0));
    };

    /**
     * Puts items back at the front of the queue, after the text translations.
     * @param {SarashinaQueueItem[]} items
     */
    const putInFront = (items) => {
      const textTranslations = queue.filter((item) => item.isTextTranslation);
      const others = queue.filter(
        (item) => !item.isTextTranslation && !items.includes(item),
      );
      queue = [...textTranslations, ...items, ...others];
    };

    /**
     * Takes the page paragraphs for up to `slots` requests from the front of the queue.
     * @param {number} slots
     * @returns {SarashinaQueueItem[][]}
     */
    const planPageBatches = (slots) => {
      const first = queue.find((item) => !item.isTextTranslation);
      if (!first) return [];
      const candidates = queue.filter(
        (item) =>
          !item.isTextTranslation &&
          item.sourceLanguage === first.sourceLanguage &&
          item.targetLanguage === first.targetLanguage,
      );
      const totalLength = candidates.reduce(
        (total, item) => total + item.text.length + 1,
        0,
      );

      let targetLength = maxBatchLength;
      if (totalLength <= slots * maxBatchLength) {
        // Everything fits: split it evenly so the requests finish at about the same time.
        // If one slot can be spared, keep it for content added to the page later.
        const usableSlots =
          slots > 1 && totalLength <= (slots - 1) * maxBatchLength
            ? slots - 1
            : slots;
        const batchCount = Math.min(
          usableSlots,
          Math.max(1, Math.ceil(totalLength / minSplitLength)),
        );
        targetLength = Math.ceil(totalLength / batchCount);
      }

      const keepFirstBatchSmall =
        totalLength > slots * maxBatchLength && startedFromIdle;
      startedFromIdle = false;

      const batches = [];
      let index = 0;
      while (batches.length < slots && index < candidates.length) {
        const batchTargetLength =
          batches.length === 0 && keepFirstBatchSmall
            ? Math.min(targetLength, firstBatchLength)
            : targetLength;
        const batch = [];
        let length = 0;
        while (index < candidates.length) {
          const item = candidates[index];
          if (
            batch.length > 0 &&
            (length + item.text.length + 1 > maxBatchLength ||
              length >= batchTargetLength)
          )
            break;
          batch.push(item);
          length += item.text.length + 1;
          index++;
        }
        batches.push(batch);
      }

      const taken = new Set(batches.flat());
      queue = queue.filter((item) => !taken.has(item));
      return batches;
    };

    const pump = () => {
      const now = Date.now();
      while (
        requestTimes.length > 0 &&
        requestTimes[0] <= now - rateLimitWindow
      ) {
        requestTimes.shift();
      }

      if (pendingLookups > 0) {
        schedulePump(COALESCE_DELAY);
      } else if (queue.length > 0 && pausedUntil > now) {
        schedulePump(pausedUntil - now);
      } else if (queue.length > 0) {
        let freeSlots = maxRequests - requestTimes.length;

        while (freeSlots > 0 && queue[0]?.isTextTranslation) {
          requestTimes.push(now);
          sendBatch([queue.shift()]);
          freeSlots--;
        }

        const pageSlots = freeSlots - reservedForTextTranslation;
        if (pageSlots > 0) {
          for (const batch of planPageBatches(pageSlots)) {
            requestTimes.push(now);
            sendBatch(batch);
          }
        }

        if (queue.length > 0 && requestTimes.length > 0) {
          // wait for the next free slot
          schedulePump(requestTimes[0] + rateLimitWindow - now + 100);
        }
      }
      updateKeepAlive();
    };

    /**
     * @param {SarashinaQueueItem[]} batch
     */
    const sendBatch = async (batch) => {
      requestsInFlight++;
      try {
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + apiKey,
          },
          body: JSON.stringify({
            text: batch.map((item) => item.text).join("\n"),
            source_lang: batch[0].sourceLanguage,
            target_lang: batch[0].targetLanguage,
          }),
        });

        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get("Retry-After"));
          pausedUntil = Math.max(
            pausedUntil,
            Date.now() + (isNaN(retryAfter) ? 60 : retryAfter) * 1000,
          );
          putInFront(batch);
          return;
        }
        if (!response.ok) {
          throw new Error(
            `Sarashina: HTTP ${response.status} ${await response.text()}`,
          );
        }

        /** @type {string} */
        const translatedText = (await response.json()).translated_text;
        if (batch.length === 1) {
          // the API ends lines with two spaces (markdown line breaks)
          batch[0].resolve(translatedText.replace(/[ \t]+\n/g, "\n").trim());
          return;
        }

        let lines = translatedText.split("\n").map((line) => line.trim());
        if (lines.length !== batch.length) {
          lines = lines.filter((line) => line);
        }
        if (lines.length === batch.length) {
          batch.forEach((item, i) => item.resolve(lines[i]));
        } else {
          // The model merged or split some lines (usually sentence fragments around inline formulas).
          // Resending them would fail the same way, so match the lines by length instead.
          console.warn(
            `Sarashina: expected ${batch.length} lines, got ${lines.length}. Aligning them by length.`,
          );
          const aligned = alignLines(
            batch.map((item) => item.text),
            lines,
          );
          const dropped = [];
          batch.forEach((item, i) => {
            if (aligned[i] === null) dropped.push(item);
            else item.resolve(aligned[i]);
          });
          if (dropped.length > 0) putInFront(dropped);
        }
      } catch (e) {
        console.error(e);
        batch.forEach((item) => item.reject(e));
      } finally {
        requestsInFlight--;
        schedulePump(0);
      }
    };

    /**
     * @param {string} sourceLanguage
     * @param {string} targetLanguage
     * @returns {[string, string] | null} `[sourceLanguage, targetLanguage]`, or null if the target is not supported.
     */
    const fixLanguages = (sourceLanguage, targetLanguage) => {
      if (targetLanguage !== "ja" && targetLanguage !== "en") return null;
      if (
        (sourceLanguage !== "ja" && sourceLanguage !== "en") ||
        sourceLanguage === targetLanguage
      ) {
        sourceLanguage = targetLanguage === "ja" ? "en" : "ja";
      }
      return [sourceLanguage, targetLanguage];
    };

    /**
     * @param {string[]} sourceArray
     * @param {boolean} isTextTranslation
     */
    const getParagraphText = (sourceArray, isTextTranslation) => {
      const originalText = sourceArray.join("").replace(/\u200b/g, " ");
      const text = isTextTranslation
        ? originalText.trim()
        : originalText.replace(/\s+/g, " ").trim();
      return { originalText, text };
    };

    /** @type {Map<string, Promise<string>>} */
    const translationsInProgress = new Map();

    /**
     * @param {string} text
     * @param {string} sourceLanguage
     * @param {string} targetLanguage
     * @param {boolean} isTextTranslation
     * @returns {Promise<string>}
     */
    const enqueue = (text, sourceLanguage, targetLanguage, isTextTranslation) => {
      const key = [sourceLanguage, targetLanguage, isTextTranslation, text].join(
        ", ",
      );
      let promise = translationsInProgress.get(key);
      if (!promise) {
        if (queue.length === 0 && requestsInFlight === 0) startedFromIdle = true;
        const maxLength = isTextTranslation ? maxTextLength : maxBatchLength;
        promise = Promise.all(
          splitText(text, maxLength).map(
            (part) =>
              new Promise((resolve, reject) =>
                (isTextTranslation
                  ? queue.unshift.bind(queue)
                  : queue.push.bind(queue))({
                  key,
                  text: part,
                  sourceLanguage,
                  targetLanguage,
                  isTextTranslation,
                  resolve,
                  reject,
                }),
              ),
          ),
        ).then((parts) => parts.join(isTextTranslation ? "\n" : " "));
        translationsInProgress.set(key, promise);
        promise.then(
          () => translationsInProgress.delete(key),
          () => translationsInProgress.delete(key),
        );
      }
      return promise;
    };

    return /** @type {Service} */ (
      /** @type {?} */ ({
        serviceName: "sarashina",

        removeTranslationsWithError() {},

        setLimits,

        /**
         * Drops every queued paragraph, of all tabs. Requests already sent are not affected.
         */
        clearQueue() {
          const items = queue;
          queue = [];
          items.forEach((item) => item.reject(new Error("Sarashina: queue cleared")));
          updateKeepAlive();
        },

        /**
         * State of the queue and the rate limit, shown in the popup.
         */
        getStatus() {
          const now = Date.now();
          const recentRequests = requestTimes.filter(
            (time) => time > now - rateLimitWindow,
          );
          const freeSlots = maxRequests - recentRequests.length;
          const queuedLength = queue.reduce(
            (total, item) => total + item.text.length,
            0,
          );
          // page translation can't use the slot kept for text translations
          const slotsToWaitFor = reservedForTextTranslation + 1 - freeSlots;
          const nextSlotIn =
            slotsToWaitFor > 0
              ? Math.max(
                  0,
                  recentRequests[slotsToWaitFor - 1] + rateLimitWindow - now,
                )
              : 0;
          const pausedFor = Math.max(0, pausedUntil - now);

          // rough estimate: full windows of page batches, plus the time to translate the last one
          let estimatedTime = 0;
          if (queuedLength > 0) {
            const lengthPerWindow =
              (maxRequests - reservedForTextTranslation) *
              maxBatchLength;
            estimatedTime =
              Math.max(nextSlotIn, pausedFor) +
              (Math.ceil(queuedLength / lengthPerWindow) - 1) * rateLimitWindow +
              15000;
          } else if (requestsInFlight > 0) {
            estimatedTime = 15000;
          }

          return {
            queuedItems: queue.length,
            queuedLength,
            requestsInFlight,
            freeSlots,
            maxSlots: maxRequests,
            windowSeconds: Math.round((rateLimitWindow - 2000) / 1000),
            nextSlotIn,
            pausedFor,
            estimatedTime,
          };
        },

        /**
         * The inline fragments of each `sourceArray` are translated together as one paragraph;
         * the result is placed in the first fragment and the others are replaced with a space.
         * @param {string} sourceLanguage
         * @param {string} targetLanguage
         * @param {string[][]} sourceArray2d
         * @param {boolean} dontSaveInPersistentCache
         * @param {boolean} dontSortResults - This parameter is not used
         * @param {boolean} isTextTranslation - Translations from the text translation UI: keep line breaks and send them first.
         * @returns {Promise<string[][]>}
         */
        async translate(
          sourceLanguage,
          targetLanguage,
          sourceArray2d,
          dontSaveInPersistentCache = false,
          dontSortResults = false,
          isTextTranslation = false,
        ) {
          const languages = fixLanguages(sourceLanguage, targetLanguage);
          if (!languages) return sourceArray2d.map(() => []);
          [sourceLanguage, targetLanguage] = languages;

          pendingLookups++;
          const paragraphs = await Promise.all(
            sourceArray2d.map(async (sourceArray) => {
              const { originalText, text } = getParagraphText(
                sourceArray,
                isTextTranslation,
              );
              const cacheEntry = text
                ? await translationCache.get(
                    "sarashina",
                    sourceLanguage,
                    targetLanguage,
                    originalText,
                  )
                : null;
              return { sourceArray, originalText, text, cacheEntry };
            }),
          ).finally(() => pendingLookups--);

          // queue all paragraphs of this call before sending, so they can be packed in the same batch
          const promises = paragraphs.map(
            async ({ sourceArray, originalText, text, cacheEntry }) => {
              if (!text) return sourceArray.map(() => " ");
              // numbers, symbols and formula fragments: nothing to translate
              if (!/\p{L}{2}/u.test(text)) return sourceArray;
              let translatedText = cacheEntry?.translatedText;
              if (!translatedText) {
                translatedText = await enqueue(
                  text,
                  sourceLanguage,
                  targetLanguage,
                  isTextTranslation,
                );
                if (!dontSaveInPersistentCache && translatedText) {
                  translationCache.set(
                    "sarashina",
                    sourceLanguage,
                    targetLanguage,
                    originalText,
                    translatedText,
                    sourceLanguage,
                  );
                }
              }
              return sourceArray.map((_, i) => (i === 0 ? translatedText : " "));
            },
          );
          schedulePump(isTextTranslation ? 0 : COALESCE_DELAY);

          const results = await Promise.allSettled(promises);
          return results.map((result) =>
            result.status === "fulfilled" ? result.value : [],
          );
        },

        /**
         * Moves the queued paragraphs of `sourceArray2d` (usually the ones on screen) to the front of the queue.
         * @param {string} sourceLanguage
         * @param {string} targetLanguage
         * @param {string[][]} sourceArray2d
         */
        prioritize(sourceLanguage, targetLanguage, sourceArray2d) {
          const languages = fixLanguages(sourceLanguage, targetLanguage);
          if (!languages) return;
          const keys = new Set(
            sourceArray2d.map(
              (sourceArray) =>
                [
                  ...languages,
                  false,
                  getParagraphText(sourceArray, false).text,
                ].join(", "),
            ),
          );
          putInFront(queue.filter((item) => keys.has(item.key)));
        },
      })
    );
  };

  /** @type {Map<string, Service>} */
  const serviceList = new Map();

  serviceList.set("google", googleService);
  serviceList.set("yandex", yandexService);
  serviceList.set("bing", bingService);
  serviceList.set(
    "deepl",
    /** @type {Service} */ /** @type {?} */ (deeplService),
  );

  /**
   * Get translation service from your name
   * Make sure the service is enabled
   * @param {string} serviceName
   * @returns {Service} service
   */
  const getSafeServiceByName = (serviceName) => {
    if (
      twpConfig.get("enabledServices").includes(serviceName) ||
      twpConfig.get("customServices").find((cs) => cs.name === serviceName)
    ) {
      return serviceList.get(serviceName);
    } else {
      return null;
    }
  };

  translationService.translateHTML = async (
    serviceName,
    sourceLanguage,
    targetLanguage,
    sourceArray2d,
    dontSaveInPersistentCache = false,
    dontSortResults = false,
  ) => {
    serviceName = twpLang.getAlternativeService(
      targetLanguage,
      serviceName,
      true,
    );
    const service = getSafeServiceByName(serviceName);
    return await service.translate(
      sourceLanguage,
      targetLanguage,
      sourceArray2d,
      dontSaveInPersistentCache,
      dontSortResults,
    );
  };

  translationService.translateText = async (
    serviceName,
    sourceLanguage,
    targetLanguage,
    sourceArray,
    dontSaveInPersistentCache = false,
  ) => {
    serviceName = twpLang.getAlternativeService(
      targetLanguage,
      serviceName,
      false,
    );
    const service = getSafeServiceByName(serviceName);
    return (
      await service.translate(
        sourceLanguage,
        targetLanguage,
        sourceArray.map((text) => [text]),
        dontSaveInPersistentCache,
        false,
        true,
      )
    ).map((result) => result[0]);
  };

  translationService.translateSingleText = async (
    serviceName,
    sourceLanguage,
    targetLanguage,
    originalText,
    dontSaveInPersistentCache = false,
  ) => {
    serviceName = twpLang.getAlternativeService(
      targetLanguage,
      serviceName,
      false,
    );
    const service = getSafeServiceByName(serviceName);
    return (
      await service.translate(
        sourceLanguage,
        targetLanguage,
        [[originalText]],
        dontSaveInPersistentCache,
        false,
        true,
      )
    )[0][0];
  };

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // If the translation request came from an incognito window, the translation should not be cached on disk.
    let dontSaveInPersistentCache = true;
    if (twpConfig.get("enableDiskCache") !== "yes") {
      dontSaveInPersistentCache = true;
    } else {
      dontSaveInPersistentCache = sender.tab ? sender.tab.incognito : false;
    }

    if (request.action === "translateHTML") {
      translationService
        .translateHTML(
          request.translationService,
          request.sourceLanguage,
          request.targetLanguage,
          request.sourceArray2d,
          dontSaveInPersistentCache,
          request.dontSortResults,
        )
        .then((results) => sendResponse(results))
        .catch((e) => {
          sendResponse();
          console.error(e);
        });

      return true;
    } else if (request.action === "translateText") {
      translationService
        .translateText(
          request.translationService,
          request.sourceLanguage,
          request.targetLanguage,
          request.sourceArray,
          dontSaveInPersistentCache,
        )
        .then((results) => sendResponse(results))
        .catch((e) => {
          sendResponse();
          console.error(e);
        });

      return true;
    } else if (request.action === "translateSingleText") {
      translationService
        .translateSingleText(
          request.translationService,
          request.sourceLanguage,
          request.targetLanguage,
          request.source,
          dontSaveInPersistentCache,
        )
        .then((results) => sendResponse(results))
        .catch((e) => {
          sendResponse();
          console.error(e);
        });

      return true;
    } else if (request.action === "removeTranslationsWithError") {
      serviceList.forEach((service) => {
        if (service.removeTranslationsWithError) {
          service.removeTranslationsWithError();
        }
      });
    } else if (request.action === "createLibreService") {
      serviceList.set(
        "libre",
        createLibreService(request.libre.url, request.libre.apiKey),
      );
    } else if (request.action === "removeLibreService") {
      serviceList.delete("libre");
    } else if (request.action === "createDeeplFreeApiService") {
      serviceList.set(
        "deepl",
        createDeeplFreeApiService(request.deepl_freeapi.apiKey),
      );
    } else if (request.action === "removeDeeplFreeApiService") {
      serviceList.set(
        "deepl",
        /** @type {Service} */ /** @type {?} */ (deeplService),
      );
    } else if (request.action === "updateSarashinaLimits") {
      serviceList.get("sarashina")?.setLimits(request.limits);
    } else if (request.action === "clearSarashinaQueue") {
      serviceList.get("sarashina")?.clearQueue();
      sendResponse();
    } else if (request.action === "getSarashinaStatus") {
      sendResponse(serviceList.get("sarashina")?.getStatus() || null);
    } else if (request.action === "prioritizeTranslations") {
      const service = serviceList.get(request.translationService);
      if (service?.prioritize) {
        service.prioritize(
          request.sourceLanguage,
          request.targetLanguage,
          request.sourceArray2d,
        );
      }
    } else if (request.action === "createSarashinaService") {
      serviceList.set(
        "sarashina",
        createSarashinaService(request.sarashina.apiKey, request.sarashina),
      );
    } else if (request.action === "removeSarashinaService") {
      serviceList.delete("sarashina");
    }
  });

  twpConfig.onReady(function () {
    if (twpConfig.get("customServices").find((cs) => cs.name === "libre")) {
      const libre = twpConfig
        .get("customServices")
        .find((cs) => cs.name === "libre");
      serviceList.set("libre", createLibreService(libre.url, libre.apiKey));
    }

    if (
      twpConfig.get("customServices").find((cs) => cs.name === "deepl_freeapi")
    ) {
      const deepl_freeapi = twpConfig
        .get("customServices")
        .find((cs) => cs.name === "deepl_freeapi");
      serviceList.set("deepl", createDeeplFreeApiService(deepl_freeapi.apiKey));
    }

    const sarashina = twpConfig
      .get("customServices")
      .find((cs) => cs.name === "sarashina");
    if (sarashina) {
      serviceList.set(
        "sarashina",
        createSarashinaService(sarashina.apiKey, sarashina),
      );
    }

    const proxyServers = twpConfig.get("proxyServers");
    if (proxyServers?.google?.translateServer) {
      const url = new URL(googleService.baseURL);
      url.host = proxyServers.google.translateServer;
      googleService.baseURL = url.toString();
    }
  });

  twpConfig.onChanged((name, newValue) => {
    if (name === "proxyServers") {
      if (newValue?.google?.translateServer) {
        const url = new URL(googleService.baseURL);
        url.host = newValue.google.translateServer;
        googleService.baseURL = url.toString();
      } else {
        const url = new URL(googleService.baseURL);
        url.host = "translate-pa.googleapis.com";
        googleService.baseURL = url.toString();
      }
    }
  });

  return translationService;
})();
