/*
Binding in HTML - if there are multiple namespaces, binding should be done as data-i18n="ns:key". eg: data-i18n="desk:Desking"
*/
var localization = localization || {
    localizationContext: i18next,
    getTranslation: i18next.t,
    localizeBody: () => {
        $("body").localize();
    },
    loadingComplete: typeof jQuery !== 'undefined' ? jQuery.Deferred() : undefined,
    initialize: function() {
        var isInitialized = false;

        return (namespaces, callBackFunction) => {
            if (isInitialized) {
                i18next.loadNamespaces(namespaces, function (err, t) {
                    localization.localizeBody();
                    callBackFunction && callBackFunction();
                });
            } else {
                isInitialized = true;
                const siteName = window.location.pathname.split("/")[1];
                const languageDetectorOptions = {
                    order: ["localStorage", "navigator"],
                    caches: null
                }
                const initOptions = {
                    debug: false,
                    load: "currentOnly",
                    fallbackLng: "en-US",
                    supportedLngs: ["en-US","fr-CA","es"],
                    keySeparator: "*",
                    ns: namespaces,
                    backend: {
                        loadPath: `/${siteName}/fresh/eLead-V45/elead_track/Localization/TranslationFiles/{{lng}}/{{ns}}.json`
                    },
                    detection: languageDetectorOptions
                };

                return i18next
                    .use(i18nextHttpBackend)
                    .use(window.i18nextBrowserLanguageDetector)
                    .init(initOptions,
                        function (err, t) {
                            jqueryI18next.init(i18next, $);
                            localization.localizeBody();
                            localization.loadingComplete && localization.loadingComplete.resolve();
                            callBackFunction && callBackFunction();
                        });
            }
        };
    }()
};