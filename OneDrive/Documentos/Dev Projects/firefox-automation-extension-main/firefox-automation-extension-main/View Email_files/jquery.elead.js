(function ($) {

    if (!$) { return; }
    //perhaps this could be more generic in the future, right now it just orders select options

    // globals for general use
    var objectHash = {}; // New object
    // global hastable constant keys
    var HK_YEAR = "HK_YEAR";
    var HK_MAKE = "HK_MAKE";
    var HK_MODEL = "HK_MODEL";

    $.fn.sort = function () {
        var c = this.children(), l = c.length, cc = [];
        while (l--) {
            $(c[l]).detach();
            cc.push({ sortField: $(c[l]).text(), elm: c[l] });
        }
        cc.sort(function (a, b) {

            if (a.sortField.toLowerCase() > b.sortField.toLowerCase()) return -1;
            if (a.sortField.toLowerCase() < b.sortField.toLowerCase()) return 1;
            return 0;
        });
        l = cc.length;
        while (l--) {
            this.append(cc[l].elm);
        }

    }
    $.querystring = function (key) {
        var query = window.location.search.substring(1);
        var vars = query.split("&");
        for (var i = 0; i < vars.length; i++) {
            var pair = vars[i].split("=");
            if (pair[0] == key) {
                return pair[1];
            }
        }
        return null;

    }

    $.addToPostBack = function (func) {
        if (window.__doPostBack) {
            var old__doPostBack = __doPostBack;
            if (typeof __doPostBack != 'function') {
                __doPostBack = func;
            } else {
                __doPostBack = function (t, a) {
                    if (func(t, a)) old__doPostBack(t, a);
                }
            }
            return { reset: function () { __doPostBack = old__doPostBack; }, original: old__doPostBack }
        }
        else {
            return { reset: function () { }, original: null }
        }
    };
    $.confirm = function (y, n, msg, mask, options) {
        var defaults = { //these were the original values in the modal - this was added for adaptability in implementation
            width: "300px",
            height: "100px",
            textAlign: "left"
        };

        var options = $.extend(defaults, options);
        var modal = $('<div style="width:' + options.width + ';height:' + options.height + ';background-color:white;padding:10px; border:1px solid #808080;" ><div style="text-align:' + options.textAlign + '">' + msg + '<br><div style="text-align:center; background:#e2e2e2; width:100%; padding:3px;"><button id="yes" type="button"><span data-i18n="Elead:Yes">Yes</span></button>&nbsp;<button id="no" type="button"><span data-i18n="Elead:No">No</span></button></div></div>');

        modal.find("#yes").click(y);
        modal.find("#no").click(n);
        if (mask)
            return mask.show(modal);
        else
            return $.getMask(modal);


    }

    $.fn.outerHTML = function () {
        return $('<div></div>').append(this.clone()).html();
    }

    $.fn.bookDropDown = function (options) {


        var defaults = {
            bookChangedFunction: function (source, book) {
                var formID = $("form").attr('id');
                $("#" + formID + "").submit();
            }
            , cookieName: ""
            , NADA: false
            , BlackBook: false
            , KBB: false
            , Galves: false
            , useColumnNameAsCookieValue: false
            , padding: 3
        };

        var options = $.extend(defaults, options);

        var styleAdditions = '.bookMain {padding:' + options.padding + 'px; margin:2px;} ' +
            '.bookMain:hover {background:#e2e2e2; cursor: default;} ' +
            '.bookMainSelected { background-image:url("../images/ig_cal_silverN.gif"); background-repeat: no-repeat; background-position: right; background-size: 4px 8px} ' +
            '#listBookMains {display:none;} ' +
            '#listBookType {display:none;} ' +
            '#listBookMains ul {list-style-type:none; background:#fff; border-left: solid 1px #b2b2b2; border-right: solid 1px #b2b2b2; border-bottom: solid 1px #b2b2b2; padding: ' + options.padding + 'px;} ' +
            '#listBookType ul {list-style-type:none; background:#fff; border-left: solid 1px #b2b2b2; border: solid 1px #b2b2b2; padding: 3px;} ' +
            '#' + $(this).attr("id") + ' {cursor: default;text-align:left; text-overflow: ellipsis; white-space:nowrap; overflow:hidden; width:150px; border:1px solid #b2b2b2; padding:1px; background-color:#fff; background-image:url("../images/asc.gif"); background-repeat: no-repeat; background-position: right; background-size: 21px 4px; display:inline-block; color:#000;} ';

        var elementAdditions = '<!-- javascript book dropdown -->' +
            '<div id="listBookMains" style="z-index:3000; position:absolute;">' +
            '    <ul>' +
            '    </ul>' +
            '</div>' +
            '<div id="listBookType" style="z-index:3001; position:absolute;">' +
            '    <ul>' +
            '    </ul>' +
            '</div>' +
            '<!-- end book add -->';

        $(document).find("form").append(elementAdditions);
        $("<style type='text/css'>" + styleAdditions + "</style>").appendTo("head");

        //$("#" + $(this).attr("id") + "").text('hello');
        var builtDD = $("#" + $(this).attr("id") + "");


        $.ajax({
            async: true,
            cache: false,
            dataType: "json",
            error: function (xmlHttpReq, status, err) { alert(err); },
            success: function (data, status, xmlHttpReq) {
                var jsonBooks = data;

                var cookieVal = $.getCookie(options.cookieName);
                console.log(options.cookieName + ' - ' + cookieVal);
                //console.log(options.useColumnNameAsCookieValue);
                console.log(jsonBooks);
                if (jsonBooks !== undefined) {
                    for (var b = 0; b < jsonBooks.book.length; b++) {
                        var value = jsonBooks.book[b].value;
                        //set cookieBook value to the script dropdown
                        if (cookieVal === undefined) {
                            if (options.useColumnNameAsCookieValue) {
                                if (options.NADA)
                                    cookieVal = "NADA_Clean_Retail";
                                else if (options.BlackBook)
                                    cookieVal = "BlackBook_loan";
                                else if (options.Galves)
                                    cookieVal = "GalvesMarketPrice";
                                else if (options.KBB)
                                    cookieVal = "KellyBlueBook_tradeIn_good";

                            }
                            else { cookieVal = "799"; }
                            $.setCookie(options.cookieName, cookieVal);
                        }
                        else if (parseInt(cookieVal) < 785) {
                            if (options.useColumnNameAsCookieValue) { cookieVal = "NADA_Clean_Retail"; }
                            else { cookieVal = "799"; }
                        }


                        //console.log(options.bookToShow);     
                        //                                if (options.bookToShow !== undefined) 
                        //                                {builtDD.text(options.bookToShow)}
                        //                                else
                        //                                {   
                        for (var sb = 0; sb < jsonBooks.book[b].types.length; sb++) {
                            if (options.useColumnNameAsCookieValue) {
                                if (jsonBooks.book[b].types[sb].columnName == cookieVal) {
                                    builtDD.text(value + " " + jsonBooks.book[b].types[sb].name); //cookie name
                                }
                            }
                            else {
                                if (jsonBooks.book[b].types[sb].nliID == cookieVal) {
                                    builtDD.text(value + " " + jsonBooks.book[b].types[sb].name); //cookie name
                                }
                            }
                        }
                        //                                }


                        //build main book element
                        var bItem = $("<li id='" + value + "' class='bookMain'>" + value + "</li>"
                        ).data('subCategory', jsonBooks.book[b] //add data
                        ).mouseenter(function () { //add click
                            //based on data generate subCat list
                            $("#listBookType ul").empty();
                            var sbCat = $(this).data().subCategory;
                            //append available individual book types to list

                            for (var sb = 0; sb < sbCat.types.length; sb++) {

                                var sbName = sbCat.types[sb].name; //name of book
                                var sbID = sbCat.types[sb].nliID; //nli
                                var sbColumn = sbCat.types[sb].columnName;

                                var sbItem = $("<li id='" + sbID + "' column='" + sbColumn + "' class='bookMain'>" + sbName + "</li>"
                                ).click(function () {
                                    $("#listBookMains").hide('fast');
                                    $("#listBookType").hide('fast');
                                    //set main value to show selected main book
                                    builtDD.text(sbCat.value + " " + $(this).text());
                                    var nliID = $(this).attr('id');
                                    var bookColumnName = $(this).attr('column');
                                    //set booktype to nli
                                    $("#bookType").val(nliID);
                                    //set cookie
                                    if (options.useColumnNameAsCookieValue) { $.setCookie(options.cookieName, bookColumnName); }
                                    else { $.setCookie(options.cookieName, nliID); }

                                    //let function do jobby
                                    options.bookChangedFunction(nliID, sbCat)

                                });
                                $("#listBookType ul").append(sbItem);
                            }

                            var booksMain = ($(this));
                            var booksMainOS = booksMain.offset();
                            $("#listBookType").css("left", booksMainOS.left + ($("#listBookMains").width() - 10)).css("top", booksMainOS.top - 5).css("width", 150);
                            $("#listBookType").show('fast').mouseleave(function () { $(this).hide(); });
                        }
                        );
                        $("#listBookMains ul").append(bItem);
                    }

                }

            },
            type: "GET",
            url: "../WebServices/ScriptingServices/functions.ashx?cmd=getcompanybooklist&NADA=" + options.NADA + "&BLACKBOOK=" + options.BlackBook + "&KBB=" + options.KBB + "&GALVES=" + options.Galves + "&r=" + Math.random()

        });

        $(document).click(function () {
            //if anything else is clicked on the page - hide the expanded elements
            $("#listBookType").hide('fast');
            $("#listBookMains").hide('fast');
        })
        return $(this).click(function (e) {
            e.stopPropagation();
            var bookElem = ($(this).offset());
            //set position
            $("#listBookMains").css("left", bookElem.left).css("top", bookElem.top + ($(this).height() - 8)).css("width", $(this).width()).height($("#listBookMains ul li").length * 30);
            $("#listBookMains").toggle('fast');
            //set subList to hidden if toggle is off
            if (!$("#listBookMains").is('visible')) {
                $("#listBookType").hide('fast');
            }
            return false;
        });

    }

    $.vehiclesAvailableByVIN = function (inv, cust, newVeh, app, n, coBuy, data, mask, loc, optionalText) {
        localizationinitialized(function () {
        var defaults = {
            invText: localization.getTranslation("Elead:The vehicle is currently in Inventory"),
            custText: "",
            newVehText: "",
            appText: localization.getTranslation("Elead:The VIN was entered on"),
            nText: ""
        }

        optionalText = $.extend(defaults, optionalText);

        var modal = $('<div style="width:400px; padding:5px; height:auto;border:solid 1px #000;background:#fff; font-family: arial; text-align:center; font-size:12px;" class="no">&nbsp;- <span data-i18n="Elead:PLEASE CHOOSE ONE OF THE OPTIONS BELOW">PLEASE CHOOSE ONE OF THE OPTIONS BELOW -</span> -<div style="height:5px;"></div></div>');

        if (data.inventory != undefined) {
            //inventory 
            var stock = data.inventory.StockNumber != "" ? data.inventory.StockNumber : localization.getTranslation("Elead:Is not available");
            var invT = optionalText.invText;
            if (invT.indexOf('{0}') > -1)
                invT = optionalText.invText.replace('{0}', stock);
            //this is a currently active inventory vehicle VIN - only one choice - enter another VIN
            if (loc.toString().toLowerCase().indexOf("appraising/default") == -1)
                modal = $('<div style="width:400px; padding:5px; height:auto;border:solid 1px #000;background:#fff; font-family: arial; text-align:center; font-size:12px;" class="no">' + invT + '<div style="height:5px;"></div></div>');
            else
                modal.append('<div style="height:45px; padding:2px; width:auto; cursor:pointer;" class="inv">' +
                    '<button style="width:100%; height:100%;cursor:pointer; border:1px solid #b2b2b2; background:#e8e8e8; font-size:11px;" type="button">' +
                    '' + invT +
                    '</button>' +
                    '</div>');
        }
        else if (data.appraisals != undefined || data.sales != undefined) {
            //appraisal
            var height = "45";
            var personId = data.appraisals != undefined ? data.appraisals.lPersonID : (data.sales != undefined ? data.sales.lPersonID : "");
            var colorId = data.appraisals != undefined ? data.appraisals.nliColorId : (data.sales != undefined ? data.sales.nliColorId : "");
            if (personId !== "") {
                if (loc.toString().toLowerCase().indexOf("appraising/default") > -1) {//valid appraisal already associated a customer
                    modal.append('<div style="height:' + height + 'px; padding:2px; width:auto;" class="cust">' +
                        '<button style="width:100%; height:100%;cursor:pointer; border:1px solid #b2b2b2; background:#e8e8e8; font-size:11px;" type="button" cursor:pointer;>' + optionalText.custText + '.<br>' +
                        '</button>' +
                        '</div>');
                }
                else if (loc.toString().toLowerCase().indexOf("kiosk_frm_newprospect") > -1) {//active vehicle called from add prospect page
                    modal.append('<div style="font-size:11px;padding-top:3px;">' + optionalText.custText + '' +
                        '<div style="height:22px; padding:2px; width:auto;font-size:11px;" class="cust">' +
                        '<button style="width:100%; height:100%;cursor:pointer; border:1px solid #b2b2b2; background:#e8e8e8; font-size:11px;" type="button" cursor:pointer;><span data-i18n="Elead:Use this existing Customer">Use this existing Customer...</span>' +
                        '</button>' +
                        '</div>' +
                        '</div>-<br>');
                }
                else {//active vehicle already associated a customer
                    modal.append('<div style="font-size:11px;padding-top:3px;">' + optionalText.custText + '' +
                        '<div style="height:22px; padding:2px; width:auto;font-size:11px;" class="cust">' +
                        '<button style="width:100%; height:100%;cursor:pointer; border:1px solid #b2b2b2; background:#e8e8e8; font-size:11px;" type="button" cursor:pointer;><span data-i18n="Elead:Merge the Deals">Merge the Deals...</span>' +
                        '</button>' +
                        '</div>');
                    if (colorId != "15") {//if the customer with existing vehicle has an active opportunity then there should be no Make Co-Buyer option
                        modal.append('<div style="height:22px; padding:2px; width:auto;" class="coBuy">' +//CO-buyer
                            '<button style="width:100%; height:100%;cursor:pointer; border:1px solid #b2b2b2; background:#e8e8e8; font-size:11px;" type="button" cursor:pointer;><span data-i18n="Elead:Submit as Co-Buyer">Submit as Co-Buyer</span><br>' +
                            '</button>' +
                            '</div>' +
                            '</div>-<br>');
                    }
                }
            }
            else {//valid appraisal not associated to customer or deal
                height = "60";
                var appT = optionalText.appText;
                if (appT.indexOf('{0}') > -1 && data.appraisals != undefined)
                    appT = appT.replace('{0}', data.appraisals.dtAppraised);
                modal.append('<div style="height:' + height + 'px; padding:2px; width:auto;" class="app">' +
                    '<button style="width:100%; height:100%;cursor:pointer; border:1px solid #b2b2b2; background:#e8e8e8; font-size:11px;" type="button" cursor:pointer;>' + appT + '<br>' +
                    '</button>' +
                    '</div>');
            }
        }

        //this is for creating a new appraisal/vehicle - only available when vehicle is sold or previously appraised
        if (data.inventory == undefined) {
            var apprVehText = localization.getTranslation("Elead:Vehicle using this VIN");
            if (loc.toString().toLowerCase().indexOf("appraising/default") > -1) apprVehText = localization.getTranslation("Elead:Appraisal using this vehicle");
            modal.append('<div style="height:5px;"></div>' +
                '<div style="height:45px; padding:2px; width:auto; cursor:pointer;" class="new">' +
                '<button style="width:100%; height:100%;cursor:pointer; border:1px solid #b2b2b2; background:#e8e8e8; font-size:11px;" type="button"><span data-i18n="Elead:Create a new">Create a new </span> ' + apprVehText + '...<br><span data-i18n="Elead:All other vehicles associated to this VIN will be set to inactive">(all other vehicles associated to this VIN will be set to inactive)</span></button>' +
                '</div>');
        }

        //this is a default option to remove the VIN and start over
        modal.append('<div style="height:5px;"></div>' +
            '<div style="height:45px; padding:2px; width:auto; cursor:pointer;" class="no">' +
            '<button style="width:100%; height:100%;cursor:pointer; border:1px solid #b2b2b2; background:#e8e8e8; font-size:11px;" type="button"><span data-i18n="Elead:Enter a different VIN">Enter a different VIN...</span></button>' +
            '</div>');

        modal.find(".inv").click(inv);
        modal.find(".cust").click(cust);
        modal.find(".app").click(app);
        modal.find(".no").click(n);
        modal.find(".new").click(newVeh);
        modal.find(".coBuy").click(coBuy);
        if (mask)
            return mask.show(modal);
        else
            return $.getMask(modal);
    });
    }

    window.openWindows = [];
    //Here we override the window.open so that we can keep track of open windows in the openWindows arr.
    window.open = function (open) {
        return function (url, name, specs, replace) {
            return open(url, name, specs, replace);
        };
    }(window.open);

    //f = function to call for each window
    //o = window
    $.iterateWindows = function (f, o) {
        //iterate all open windows and call iterateWindows on them
        //find opener and call iterateWindow on it
        //find frames and call iterateWindows on it
        //to simplify, deleted everything except what is needed to this point, view history and add back when needed
        var l = window.openWindows.length, frames;
        var opnr = window.opener;
        if (opnr && opnr.$ && opnr.$.iterateWindows && opnr != o) {
            opnr.$.iterateWindows(f, window);
        }

        f(window);


    }
    window.listeners = {};
    $.addVehicleUpdateListeners = function (f) {
        if (!window.listeners['vehicleupdated'])
            window.listeners['vehicleupdated'] = [];
        window.listeners['vehicleupdated'].push(f);
    }
    //v= vehicle,what else is needed
    $.triggerVehicleUpdateListeners = function (v) {
        $.iterateWindows(function (w) {
            if (!w.listeners || !w.listeners['vehicleupdated'])
                return;
            var l = w.listeners['vehicleupdated'].length;
            while (l--) {
                w.listeners['vehicleupdated'][l](v);
            }

        });
    }


    //overwrite all console.logs so it won't bomb on different browsers
    if (!window.console) {
        window.console = { log: function () { } };
    }
    //iterate object properties and sub children and do something with each
    $.iterateObject = function (obj, fnc) {
        for (var p in obj) {
            try {
                if (obj.hasOwnProperty(p) && obj[p] && typeof obj[p] === 'object') {
                    $.iterateObject(obj[p], fnc);
                }
                fnc(obj, p);
            }
            catch (e) {
                console.log(e);
            }
        }
    }
    //don't use this unless version 1.7 is used
    $.fn.keyComboClick = function (options) {
        var settings = $.extend({
            ctrl: false,
            shft: false,
            alt: false,
            fnc: null,
            on: false,
            parent: document.body
        }, options);
        var these = this;
        //keydown only neesd to be registered for character codes - need to store variable whether they are still pressed down
        //ctrl and shift are naturally supported

        var h = function (e) {


            if (settings.ctrl && !e.ctrlKey)
                return;
            if (settings.shft && !e.shiftKey)
                return;
            if (settings.alt && !e.altKey)
                return;

            if (settings.fnc)
                settings.fnc(e.target)
        }
        var cp = [];
        $(document.body).keydown(function (e) {
            cp[e.which] = true;
        });
        $(document.body).keyup(function (e) {
            cp[e.which] = false;
        });
        if (settings.on && this.selector) {
            $(settings.parent).on('click', this.selector, h);
        }
        else {
            this.click(h);
        }


    }


    $.fn.disable = function () {
        iterateNodes(function (n) {
            $(n).attr('disabled', 'disabled');
            if ($(n).prop)
                $(n).prop('disabled', true);
        }, this[0]);
        return this;
    }
    $.fn.enable = function () {
        iterateNodes(function (n) {
            $(n).removeAttr('disabled');
            if ($(n).prop)
                $(n).prop('disabled', false);
        }, this[0]);
        return this;
    }
    $.attachSelectKeyboardChange = function () {
        $(document.body).keyup(function (e) {
            if (e.target && e.target.nodeName && e.target.nodeName.toLowerCase() === "select") {
                var keyCode = e.keyCode || e.which;
                if (keyCode == 38 || keyCode == 40) { // if up or down key is pressed
                    $(e.target).change(); // trigger the change event
                }
            }
        });
    }


    if (!$.fn.center) {
        $.fn.center = function () {
            if (!this[0].parentElement)
                $(document.body).append(this);
            this.css({ 'position': 'fixed', 'top': '50%', 'left': '50%', 'margin-top': (-1 * (this.height() / 2)) + 'px', 'margin-left': (-1 * (this.width() / 2)) + 'px' });
            this.maxZIndex();
            return this;
        }
    }
    $.maxZIndex = $.fn.maxZIndex = function (opt) {
        /// <summary>
        /// Returns the max zOrder in the document (no parameter)
        /// Sets max zOrder by passing a non-zero number
        /// which gets added to the highest zOrder.
        /// </summary>    
        /// <param name="opt" type="object">
        /// inc: increment value, 
        /// group: selector for zIndex elements to find max for
        /// </param>
        /// <returns type="jQuery" />
        var def = { inc: 10, group: "*" };
        $.extend(def, opt);
        var zmax = 0;
        $(def.group).each(function () {
            var cur = parseInt($(this).css('z-index'));
            zmax = cur > zmax ? cur : zmax;
        });
        if (!this.jquery)
            return zmax;

        return this.each(function () {
            zmax += def.inc;
            $(this).css("z-index", zmax);
        });
    }


    $.fn.elemPrint = function (options) {
        var defaults = {
            frameElem: ['ifmcontentstoprint', '<iframe id=\"ifmcontentstoprint\" style=\"height: 0px; width: 0px; position: absolute\"></iframe>'],
            printElemID: "",
            landscape: false // questionable for any browser.
        };

        var options = $.extend(defaults, options)
        if (options.printElemID === "") { return; } //not valid return

        if ($("#" + options.frameElem[0] + "").length === 0)//add iframe to form //make sure the html is in position [1]
            $(document).find("form").append(options.frameElem[1]);

        $(this).click(function () {
            var content = $("#" + options.printElemID + "");
            var pri = document.getElementById(options.frameElem[0]).contentWindow;
            pri.document.open();
            pri.document.write(content.html());
            if (options.landscape) {
                var style = document.createElement('style');
                style.type = 'text/css';
                style.media = 'print';
                var css = "@media print{ @page { size: landscape } }";

                if (style.styleSheet) {
                    // IE - irrelevant as it doesn't recognize anything :tried 'filter: progid:DXImageTransform.Microsoft.BasicImage(Rotation=1);'
                    //   but it practically converts to an image and winds up printing the visible area multiple times
                    style.styleSheet.cssText = css;
                } else {
                    style.appendChild(document.createTextNode(css));
                }
                //add to head
                pri.document.getElementsByTagName('head')[0].appendChild(style);
            }
            pri.document.close();
            pri.focus();
            pri.print();
        }
        );

        return this;
    }



    $.fn.setDraggable = function (dropTargetFunction, hoverTargetFunction, delay) {

        var currentlyDragging, dropTarget, originalNextSibling, xOffset = 0, yOffset = 0, targets = this, targetPositions, lastTarget;
        var pendingTimeOuts = [], mouseUpFunction = mouseUpMultiple, mouseDownFunction = mouseDownMultiple;
        var ph = $("<span></span>");

        // Retrieves an object with pageX and pageY for a jQuery event.
        var eventToCoordinates = function (event) {
            if (event.pageX) {
                return event;
            } else if (event.originalEvent.touches && event.originalEvent.touches.length > 0) {
                return event.originalEvent.touches[0];
            } else {
                alert("Unsupported event - returning default values");
                return { pageX: 0, pageY: 0 };
            }
        };

        function calcTargets(d) {
            targetPositions = [];
            var l = targets.length;
            var tp;
            var t;
            while (l--) {
                t = $(targets[l]);
                if (d[0] !== t[0]) {
                    tp = {};
                    tp.t = t;
                    tp.yMin = t.offset().top;
                    tp.yMax = t.offset().top + t.outerHeight(true);
                    tp.xMin = t.offset().left;
                    tp.xMax = t.offset().left + t.outerWidth(true);
                    targetPositions.push(tp);
                }
            }
        }
        function getTarget(e, d) {
            if (targetPositions) {
                var l = targetPositions.length;
                while (l--) {
                    var t = targetPositions[l];
                    if (t.t[0] !== d[0] && e.pageY >= t.yMin && e.pageY <= t.yMax && e.pageX >= t.xMin && e.pageX <= t.xMax) {
                        //hoving over potential target
                        //what part of the target is hovered over
                        //top, bottom, left, right = true?
                        var result = { target: t.t, left: false, right: false, top: false, bottom: false };
                        var T = t.xMin + t.t.outerWidth(true) / 2;
                        if (e.pageX > T)
                            result.right = true;
                        if (e.pageX <= T)
                            result.left = true;
                        T = t.yMin + t.t.outerHeight(true) / 2;
                        if (e.pageY < T)
                            result.top = true;
                        if (e.pageY >= T)
                            result.bottom = true;

                        return result;
                    }
                }
            }
        }

        // Handles mousemove and touchmove events
        var mouseTouchMoveHandler = function (e) {
            if (currentlyDragging) {
                if (e.type === 'touchmove')
                    e.preventDefault(); // Android needs this to call handler multiple times

                var coords = eventToCoordinates(e);
                setPosition(coords);
                var target = (getTarget(coords, currentlyDragging));
                if (target && hoverTargetFunction) {
                    lastTarget = target;
                }
                if (hoverTargetFunction && lastTarget)
                    hoverTargetFunction(lastTarget);
                calcTargets(currentlyDragging);
                e.stopPropagation();
                return false;
            }
        };

        // Handles mouseup and touchend events
        var mouseTouchUpHandler = function (e) {
            if (mouseUpFunction)
                mouseUpFunction(e);
        };

        var mouseTouchDownHandler = function (e) {
            // Fix for "can't click checkbox in iOS Safari" bug
            if (e.type === 'touchstart' && $(e.target).is('input'))
                return true;

            if (mouseDownFunction && !mouseDownFunction(e)) {
                e.stopPropagation();
                return false;
            }
        };

        // HACK: Some pages use earlier version of jQuery without .on()
        if ($(document).on) {
            $(document).on('touchmove', mouseTouchMoveHandler);
            $(document).on('touchend', mouseTouchUpHandler);
            targets.on('touchstart', mouseTouchDownHandler);
        } else {
            $(document).delegate('body', 'touchmove', mouseTouchMoveHandler);
            $(document).delegate('body', 'touchend', mouseTouchUpHandler);
            targets.delegate('*', 'touchstart', mouseTouchDownHandler);
        }

        $(document).mousemove(mouseTouchMoveHandler)
            .mouseup(mouseTouchUpHandler);
        //this cannot be registered on the document else it will conflict if a parent and child both have draggable set on them
        //haven't figured out a way to accomodate this if we want to register on the document to limit registered event handlers
        targets.mousedown(mouseTouchDownHandler);
        function mouseDownMultiple(e) {
            function findTarget(dt, e) {
                var l = targets.length;
                while (l--) {
                    if (dt[0] === targets[l]) {
                        if (delay)
                            pendingTimeOuts.push(setTimeout(function () {
                                md(e, dt);
                            }
                                , delay));
                        else
                            md(e, dt);

                        e.stopPropagation();
                        return false;
                    }
                }
                return true;
            }


            if (!findTarget($(e.target), e))
                return false;
            return findTarget($(e.currentTarget), e);


            function md(e, cd) {
                if (cd) {
                    currentlyDragging = cd;
                    var coords = eventToCoordinates(e);
                    xOffset = coords.pageX - currentlyDragging.offset().left - $(window).scrollLeft();
                    yOffset = coords.pageY - currentlyDragging.offset().top - $(window).scrollTop();
                    if (currentlyDragging.outerHeight(true) < currentlyDragging.innerHeight()) {
                        yOffset = yOffset - currentlyDragging.outerHeight(true);
                    }
                    if (currentlyDragging.outerWidth(true) < currentlyDragging.innerWidth()) {
                        xOffset = xOffset - currentlyDragging.outerWidth(true);
                    }

                    cd.after(ph);
                    cd.detach();
                    $(document.body).append(cd);
                    cd.css("position", "fixed");
                    cd.maxZIndex({ inc: 5 });

                    setPosition(coords);
                    calcTargets(cd);
                }
            }
        }

        function mouseUpMultiple(e) {
            if (currentlyDragging) {

                if (dropTargetFunction) {
                    currentlyDragging.css("position", "static");
                    var target = (getTarget(e, currentlyDragging));
                    if (target)
                        dropTargetFunction(currentlyDragging, target);
                    else if (lastTarget) {
                        dropTargetFunction(currentlyDragging, lastTarget);
                    }
                    else {
                        ph.after(currentlyDragging);
                        ph.detach();
                    }

                }

                e.stopPropagation();

            }

            if (pendingTimeOuts) {
                var l = pendingTimeOuts.length;
                while (l--) {
                    clearTimeout(pendingTimeOuts[l]);
                }
            }


            currentlyDragging = null;
            lastTarget = null;
            pendingTimeOuts = [];
        }
        function setPosition(coords) {
            currentlyDragging.css({ top: coords.pageY - yOffset, left: coords.pageX - xOffset });
        }
        return {
            addTarget: function (t) {
                targets = targets.add(t);
                t.mousedown(function (e) {

                    if (mouseDownFunction && !mouseDownFunction(e)) {
                        e.stopPropagation();
                        return false;
                    }
                });
            }
        };
    }






    $.fn.freezeHeader = function (parent, keepWidth) {
        //freeze header
        //table-layout must be fixed with set column width
        //header table width needs to be modified to account for a scroll
        var newTable = this.clone(true).find("tbody").remove().end();
        this.find("thead").remove();
        if (!keepWidth)
            newTable.css("width", (this.width()) + "px");
        newTable.removeAttr("id");
        if (parent)
            parent.append(newTable);

        else
            this.before(newTable);

        return newTable;
    }
    var scrollbarWidth = 0;
    $.getScrollbarWidth = function () {
        if (!scrollbarWidth) {
            if ($.browser.msie) {
                var $textarea1 = $('<textarea cols="10" rows="2"></textarea>')
                    .css({ position: 'absolute', top: -1000, left: -1000 }).appendTo('body'),
                    $textarea2 = $('<textarea cols="10" rows="2" style="overflow: hidden;"></textarea>')
                        .css({ position: 'absolute', top: -1000, left: -1000 }).appendTo('body');
                scrollbarWidth = $textarea1.width() - $textarea2.width();
                $textarea1.add($textarea2).remove();
            } else {
                var $div = $('<div />')
                    .css({ width: 100, height: 100, overflow: 'auto', position: 'absolute', top: -1000, left: -1000 })
                    .prependTo('body').append('<div />').find('div')
                    .css({ width: '100%', height: 200 });
                scrollbarWidth = 100 - $div.width();
                $div.parent().remove();
            }
        }
        return scrollbarWidth;
    };


    //provides complex formatting for html tables
    //settings = {bottomOffset:0,expandVertically:true,freezeHeader:true}
    if (!$.fn.horizontalTable) {
        $.fn.horizontalTable = function (bottomOffset) {
            var originalTable = this, largerOTColGroup, largerHTColGroup, originalWidth, scrollHorizontal = $("<div  style='overflow-x: scroll;overflow-y:hidden'></div>");
            var h = this.freezeHeader(scrollHorizontal, true), scrollVertical = $("<div  style='overflow-x: hidden;overflow-y:scroll;'></div>");
            this.css("table-layout", "fixed");
            scrollHorizontal.append(scrollVertical);
            this.after(scrollHorizontal)
            this.detach();
            scrollVertical.append(this);
            resize();

            $(window || window.top).resize(function (e) {
                resize();
            });
            scrollHorizontal.scroll(function (e) {
                scrollVertical.css("width", scrollHorizontal.width() + scrollHorizontal.scrollLeft());
                if (scrollVertical.width() >= getVisibleWidth() && scrollVertical.width() - $.getScrollbarWidth() < getVisibleWidth())
                    scrollVertical.css("width", scrollVertical.width() + $.getScrollbarWidth() + "px");
            });


            function getVisibleWidth() {
                //get the sum of width of all visible headers
                var visibleColumns = h.find("thead th:visible"), l, wTotal = 0, percentages = [], w;

                l = visibleColumns.length;
                while (l--) {
                    if (visibleColumns[l].clientWidth) {
                        w = visibleColumns[l].clientWidth
                    }
                    else {
                        w = $(visibleColumns[l]).outerWidth();
                    }

                    wTotal += w;
                    if (!visibleColumns[l].originalWidth)
                        visibleColumns[l].originalWidth = w;
                }

                return wTotal;

            }

            function resize() {
                var p = scrollHorizontal.parent();
                var heightOffset, parentHeight;
                if (true) {//p[0] === document.body , Not supporting specified height, the UI must expect the table to anchor to bottom of page
                    parentHeight = $(window).height();
                    heightOffset = parseInt($(document.body).css("margin-bottom"));
                }
                else {
                    parent = p.height();
                    heightOffset = 0; //not sure about this yet
                }
                height = bottomOffset ? parentHeight - scrollHorizontal.offset().top - bottomOffset - heightOffset : parentHeight - scrollHorizontal.offset().top - heightOffset;
                scrollHorizontal.height(height);
                scrollVertical.height(height - h.height() - $.getScrollbarWidth());
                scrollVertical.css("width", scrollHorizontal.width() + scrollHorizontal.scrollLeft());

                expandVertically();
            }
            //if the width of the scrollVertical is larger that the table
            //resize the table by way of colgroup cols width to fill the space up

            function expandVertically() {
                if (!originalWidth) {
                    originalWidth = getVisibleWidth();
                }
                var expandP, l, width, index, scrollWidth;
                var allColumns = h.find("thead th");
                var visibleColumns = h.find("thead th:visible");
                var wTotal = getVisibleWidth();
                largerHTColGroup = h.find("colgroup col");
                largerOTColGroup = originalTable.find("colgroup col");
                scrollWidth = $.getScrollbarWidth() + 5;


                if (scrollVertical.outerWidth() - scrollWidth >= originalWidth) {
                    l = visibleColumns.length;
                    expandP = (scrollVertical.outerWidth() - scrollWidth) / wTotal;
                    while (l--) {
                        index = allColumns.index(visibleColumns[l]);
                        width = parseFloat(largerHTColGroup[index].width);
                        width = width * expandP;
                        //percentage is not precise so ensure that the calculate width is never below the original width of the column
                        if (width > visibleColumns[l].originalWidth) {
                            largerHTColGroup[index].width = width + "px";
                            largerOTColGroup[index].width = width + "px";
                        }

                    }
                }
            }
            scrollHorizontal.show = function (e) {
                $.fn.show.call(scrollHorizontal);
                resize();

            }
            return {
                HeaderTable: h,
                BodyTable: originalTable,
                HorizontalContainer: scrollHorizontal

            };
        }
    }
    //called on the element that should invoke a hover over element when moused over
    //f = function that should be called to do stuff when hovered over including creating or assigning the element to appear, "this" will be the the element hovered over
    //delay = int miliseconds to wait while hovered over before showing element
    $.fn.hoverOver = function (f, delay, options) {
        var defaults = {
            showArrows: true
        };

        var options = $.extend(defaults, options)

        var arrowStyles = ".right-arrow-border { display:none; border-color: transparent transparent transparent #b2b2b2 ;border-style: solid; z-index:1001; border-width: 10px; height:0; width:0; position:absolute;} " +
            ".right-arrow { display:none; border-color: transparent transparent transparent #ffffff;border-style: solid; z-index:1002;border-width: 10px;height:0;width:0;position:absolute;} " +
            ".left-arrow-border { display:none; border-color: transparent #b2b2b2 transparent transparent ;border-style: solid; z-index:1001; border-width: 10px; height:0; width:0; display:none; position:absolute;} " +
            ".left-arrow { display:none; border-color: transparent #ffffff transparent transparent ;border-style: solid; z-index:1002;border-width: 10px;height:0;width:0;position:absolute;} " +
            " .leftside-shadow { border-radius: 8px; background-color: white; -moz-box-shadow: -5px 5px 10px #b2b2b2; -webkit-box-shadow: -5px 5px 10px #b2b2b2; box-shadow: -5px 5px 10px #b2b2b2; }" +
            " .rightside-shadow { border-radius: 8px; background-color: white; -moz-box-shadow: 5px 5px 10px #b2b2b2; -webkit-box-shadow: 5px 5px 10px #b2b2b2; box-shadow: 5px 5px 10px #b2b2b2; }" +
            " .lowZ {z-index: 0;}";

        if ($("#arrow").length === 0 && $("#floatDiv").length === 0) {
            $("<style type='text/css'>" + arrowStyles + "</style>").appendTo("head"); //add arrow styles
            $(document).find("form").append("<div style=\"width:300px; position: absolute; top:300px; left: 100px; display:none;z-index:1000;\" id=\"floatDiv\"><div></div><div class=\"right-arrow-border\"></div><div class=\"right-arrow\"></div>" +
                "<div class=\"left-arrow-border\"></div><div class=\"left-arrow\"></div></div>"); //add arrow divs
        }


        var r = setPositionOnEvent($(this), f, delay, 10, 0, options);
        $(this).mouseover(r.EventFunction).mouseleave(function (e) {
            r.CancelFunction(e);
        }
        );
    }
    function setPositionOnEvent(element, f, delay, leftOffset, topOffset, options) {

        var defaults = {
            showArrows: true
        };

        var options = $.extend(defaults, options)

        var h = true, t = element, pendingTimeOuts = [];
        leftOffset = leftOffset || 0;
        topOffset = topOffset || 0;


        function me(e) {
            h = true;
            var mee = function (e) {
                if (h) {
                    var go;
                    var ct = $(e.target);
                    var loc = ct.offset(); var top = loc.top; var pos;

                    if (f) {
                        go = f.call(e.target);

                    }
                    if (go) {
                        //console.log(go);
                        //height of visible area - (Y mouse position -  Vertical position of the scroll bar) < go's Height 
                        // true : 
                        //if the Position Style is fixed:
                        //Y position in view port = offset().top - $(window).scrollTop()
                        //X position in view port = offset().left - $(window).scrollLeft()
                        //if the Position Style is absolute and the element is a child of body

                        //Y position in view port = offset().top
                        //X position in view port = offset().left
                        //is the thing going to appear off the page : ct.offset().top should be replaced with the top of the element to appear, wherever that may be
                        //element is going to be off the screen up = ct.offset().top - go.height() - $(window).scrollTop()  < 0
                        //element is going to be off the screen down = ct.offset().top -  $(window).scrollTop() + go.height() > $(window).height()
                        //element is going to be off the screen left = ct.offset().left - go.width() - $(window).scrollLeft()  < 0
                        //element is going to be off the screen right = ct.offset().left -  $(window).scrollLeft() + go.width() > $(window).width()

                        var left; var bottom = false; var diff = 0;
                        go.show();
                        $("#floatDiv").show();
                        var floatDiv = $("#floatDiv");
                        //set top position
                        if ($(window).height() - (e.pageY - $(window).scrollTop()) < (go.height() + 10)) {
                            //mess with the difference to allow more appropriate positioning in UI
                            var diff = Math.floor(($(window).height() - (e.pageY - $(window).scrollTop())) / 2);
                            pos = (top - go.height()) + diff + Math.floor(diff / 2);
                            if (pos < 0) {
                                pos = 10;
                            }
                            bottom = true;
                        }
                        else {
                            pos = top - Math.floor(go.height() / 2);
                            if ((Math.floor(go.height() / 2) - 10) > (e.pageY - $(window).scrollTop())) {
                                pos = top - 65;
                            }

                        }

                        //set left position
                        var isLeft = false;
                        if (((loc.left + leftOffset) + (go.width() + 10)) > $(window).width()) {
                            left = (loc.left - (leftOffset + 20)) - go.width();
                            if (left < 0) { left = 10; }
                            isLeft = true;
                        }
                        else {
                            left = loc.left + t.width() + (leftOffset + 10);
                        }

                        var newHeight = go.height();
                        floatDiv.height(newHeight);
                        $("#floatDiv div:first").empty();
                        $("#floatDiv div:first").append(go);

                        //which arrow
                        if (isLeft) {
                            $("#floatDiv div:first div:eq(0)").removeClass().addClass('leftside-shadow');
                            if (options.showArrows) {
                                $(".right-arrow-border").css({ "top": e.pageY - (pos + topOffset) - 10, "left": floatDiv.width() }).fadeIn('fast');
                                $(".right-arrow").css({ "top": e.pageY - (pos + topOffset) - 10, "left": floatDiv.width() - 1 }).fadeIn('fast');
                            }
                        }
                        else {
                            $("#floatDiv div:first div:eq(0)").removeClass().addClass('rightside-shadow');
                            if (options.showArrows) {
                                $(".left-arrow-border").css({ "top": e.pageY - (pos + topOffset) - 10, "left": -20 }).fadeIn('fast');
                                $(".left-arrow").css({ "top": e.pageY - (pos + topOffset) - 10, "left": -19 }).fadeIn('fast');
                            }
                        }
                        $("#floatDiv").css({ "left": (left) + "px", "top": (pos + topOffset) + "px" });


                    }


                }
            }
            if (delay)
                pendingTimeOuts.push(setTimeout(function () { mee(e) }, delay));
            else
                mee(e);
        }


        function hc(e) {
            h = false;
            var go;
            if (f) { go = f.call(e.target); }
            if (go) {
                //console.log(go.height());
                go.hide();
                //console.log($("#floatDiv"));
                $("#floatDiv").hide(); $(".floatDiv div:first div").remove();
                $(".right-arrow-border").hide(); $(".right-arrow").hide();
                $(".left-arrow-border").hide(); $(".left-arrow").hide();
                go.stop(true, true)
            }
            if (pendingTimeOuts) {
                var l = pendingTimeOuts.length;
                while (l--) {
                    clearTimeout(pendingTimeOuts[l]);
                }
            }
            pendingTimeOuts = [];
        }
        return { EventFunction: me, CancelFunction: hc };

    }

    // div element vertical position click
    $.fn.setPositionVertOnClick = function (f, delay, options) {
        var r = setPositionOnEvent($(this), f, delay, 0, 50, options);
        $(this).click(r.EventFunction);
    }

    $.fn.getMask = function (opt) {
        opt = $.extend({
            txt: 'Loading...'
        }, opt);
        var me = this, width = 150, height = 60,
            mask = $(["<div  style='position: absolute; top:0; left:0",
                "; -moz-opacity: .60; filter: alpha(opacity=60); opacity: .60;",
                "background-color:#888888; height:100%;width:100%;'></div>"].join("")),
            loading = $(["<div style='position: absolute;height: " + height + "px; width: " + width + "px; background-color: White;",
                "border: solid 1px #444; align: center; padding: 0 0 0 20px; line-height: 20px; color: #444;'>",
            "<br /><span id='loadingBlockerText' style='white-space:nowrap;'></span> <img src='" + getMainPath() + "images/ajax-loader.gif' align='middle' alt='loading' /></div>"].join("")),
            loadingText = loading.find('#loadingBlockerText');

        if (me.css('position') === 'static')
            me.css({ position: 'relative' });
        mask.maxZIndex();
        me.append(mask);
        me.append(loading);
        loadingText.text(opt.txt);
        loading.css({
            'z-index': parseInt(mask.css('z-index')) + 1
            , 'top': '50%', 'left': '50%'
            , 'margin-top': ((-1 * (height / 2))) + 'px'
            , 'margin-left': ((-1 * (width / 2))) + 'px'
        });

        var hideMask = function () {
            mask.hide();
            loading.hide();
        }

        return { hide: hideMask, show: function () { mask.show(); loading.show(); } };


    }
    $.getMask = function (modal) {
        var mask;
        var modalDialog;
        var modalText;

        function init(m) {
            if (!mask) {

                var maskMarkup = ["<div  style='position: absolute; top: 0; left:",
                    "0; display: none; -moz-opacity: .60; filter: alpha(opacity=60); opacity: .60;",
                    "background-color:#888888; height:" + $(document).height() + "px;width:" + $(document).width() + "px;'></div>"].join("");
                mask = $(maskMarkup);
                $(document.body).append(mask);
                mask.maxZIndex();
                $(window).resize(function () {
                    mask.css({ width: $(document).width(), height: $(document).height() });
                });
                $(window).scroll(function () {
                    mask.css({ width: $(document).width(), height: $(document).height() });
                });



            }

            if (!m)
                m = "Loading...."
            if (typeof m === "string") {
                if (modalText) {
                    modalText.text(m);
                }
                else {

                    m = $(["<div style='position: absolute;height: 60px; width: 150px; background-color: White;",
                        "border: solid 1px #444; align: center; padding: 0 0 0 20px; line-height: 20px; color: #444;'>",
                        "<br /><span id='loadingBlockerText' style='white-space:nowrap;'>" + m + "</span> <img src='" + getMainPath() + "images/ajax-loader.gif' align='middle' alt='loading' /></div>"].join(""));
                    modalText = m.find("#loadingBlockerText");
                    createNewDialog(m);

                }
            }
            if (modalDialog && typeof m === "object" && m !== modalDialog) { //should a new mask be created for every different modal on a page or add/remove them with same mask
                modalDialog.remove();
                createNewDialog(m);
            }
            if (!modalDialog) {
                createNewDialog(m);
            }
            mask.css({ width: $(document).width(), height: $(document).height() });
            mask.show();
            modalDialog.show();
            function createNewDialog(o) {
                $(document.body).append(m);
                modalDialog = m;
                m.center();
                m.maxZIndex();

            }

        }
        function showMask(msg) {
            msg = msg || modalDialog;
            init(msg);
        }
        function hideMask() {
            if (mask)
                mask.hide();
            if (modalDialog)
                modalDialog.hide();

        }
        function emptyMask() {
            if (mask)
                mask.empty();
            if (modalDialog)
                modalDialog.empty();
        }
        init(modal);
        return { show: showMask, hide: hideMask, empty: emptyMask };

    }
    //tired of getting references to each element manually that needs to be interacted with
    //take the id of the element and that will be the property in the elms namespace
    $.loadElementsById = function (opts) {

        window.elms = window.elms || {};
        $('[id]').each(function (a, b) {
            window.elms[b.id] = $(b);
        });
    }


    $.getImageGalleryMask = function (imageUrls, startPos) {
        var mask;
        var maskText;
        var arrowWidth = 22, gWidth = 422, duration = 300, gHeight = 300;
        var holderWidth = (arrowWidth * imageUrls.length) + (gWidth * imageUrls.length), arrowOffset = arrowWidth * imageUrls.length, index = 1, leng = imageUrls.length, imgsMarkup = '', mainI, back, forward;


        function init(startPos) {
            if (!imageUrls)
                imageUrls = [3, 3, 3]
            if (!mask) {
                for (var i = 0; i < leng; i++) {
                    imgsMarkup += "<div style='display:inline-block; width:400px; height:300px;'><img  style='margin:0px 0px 0px 0px;width:auto;height:auto; max-height:300px; max-width:400px;' src='" + imageUrls[i] + " '/></div>" +
                        "<div style='display:inline-block;width:22px'></div>";
                }

                var markup = ["<div id='loadingBlocker' style='position: absolute; top: 0; left: 0; display: none;",
                    "background-color:#fff; height:100%;width:100%;z-index:3200;'></div>",
                    "<div class='imageGallery'  style='border:solid 1px #b2b2b2; background: #fff; overflow-x:hidden;padding: 20px 0px 20px 0px ; position: fixed; top: 50%; left: 50%; height: " + gHeight + "px; width: " + (arrowWidth + gWidth) + "px;",
                    "align: center;  line-height: 20px; color: #444; z-index: 32767; display:none; margin: -" + (gHeight / 2) + "px 0 0 -" + (gWidth / 2) + "px'>",
                    "<img id='back' style='z-index:2;position:absolute;top:50%;padding-left:8px; cursor:pointer;' src='../images/ig_cal_silverP.gif'/>",
                    "<div id='imgHolder' style='position:absolute;margin:0px 0px 0px " + arrowWidth + "px;width:" + holderWidth + "px;height:" + gHeight + "px;overflow-x:hidden;overflow-y:hidden'>",
                    imgsMarkup,
                    "</div>",
                    "<img id='forward' style='z-index:2;left:" + gWidth + "px;position:absolute;top:50%; padding-left:10px; cursor:pointer;'  src='../images/ig_cal_silverN.gif'/>",
                    "</div>"];
                mask = $(markup.join(""));

                $(mask[0]).click(function (e) {
                    mask.hide();
                });
                mainI = mask.find("#imgHolder");
                back = mask.find("#back");
                forward = mask.find("#forward");

                $(mainI).click(function (e) {
                    mask.hide();
                });


                back.click(fBack);
                forward.click(fForward);

                $(document.body).css("overflow-x:", "hidden").append(mask);
            }

            if (startPos) {
                index = startPos;
                mainI.css({ left: -(gWidth * (startPos - 1)) });
            }
            mask.show();
            function fBack(e) {
                if (index === 1)
                    return;
                index--;
                back.unbind();
                mainI.animate({
                    left: '+=' + gWidth
                }, {
                    duration: duration,
                    complete: function () {
                        back.click(fBack);
                    }
                });
            }
            function fForward(e) {
                if (index === leng)
                    return;
                index++;
                forward.unbind();
                mainI.animate({
                    left: '-=' + gWidth
                }, {
                    duration: duration,
                    complete: function () {
                        forward.click(fForward);
                    }
                });
            }

        }
        function showMask(startPos) {
            init(startPos);
        }
        function hideMask() {
            if (mask)
                mask.hide();
        }
        init(startPos);
        return { show: showMask, hide: hideMask };
    }
    //create a UI element that represents the columns of a given table and allows the columns to be reordered and hidden/shown
    //accomodates the seperation of the thead an tbody which is used for fixed header tables
    //head = jquery table object where thead exists
    //body = jquery table object where tbody exists
    //issues - the jquery .hide()/.show() method will work in all browsers except for IE8, I can't find a feature to test for this so just using browser type
    //settings {head,body,columnChanged,userId,tableKey,minColumns,excludedColumns}
    $.getColumnOrganizer = function (head, body, columnChanged, userId, tableKey) {
        var ths, length, bodyColumns = [], headCols, bodyCols, isIe8 = ($.browser.msie && parseInt($.browser.version, 10) < 9),
            i, tbodyRows, headerRow, bodyColGroup, headColGroup, s = $.getCookieObject(userId + "_" + tableKey), checked = "checked='checked'",
            divOrganizer = $('<div style="border:solid 1px #b2b2b2;background-color:white;width:200px;height:400px;-webkit-user-select:none;"><table style="width:100%"><tr class="PageHeader" style="height:10px"><td><span data-i18n="Elead:Column Config">Column Config</span></td></tr></table></div>'),
            img = $("<div style='position:relative;border:solid 1px black;width:195px;display:inline-block'></div>"), columncheckboxes = $();

        init();
        if (!s) {
            s = [];
        }
        for (i = s.length; i < length; i++) { // i greater that s.length means that a new column was added to the HTML not previously stored in cookie, create new entry for it
            s.push({ visible: true, index: i });
        }

        for (i = 0; i < length; i++) { //for each column defined by the <th> 's - do stuff
            ///this is all just creating the check box and div UI that represents the column
            //----------------
            var row = $("<div class='column' style='cursor:n-resize;'></div>");
            checked = s[i].visible ? "checked='checked'" : "";
            var label = $(ths[i]).attr('label') ? $(ths[i]).attr('label') : $(ths[i]).text();
            var checkbox = $("<input type='checkbox' style='cursor:default;' " + checked + "> " + label + "</input>").change(function (setting) {
                return function (e) {
                    var index = setting.index;
                    if ($(this).is(':checked')) {
                        setColumnVisibility(index, true);
                        setting.visible = true;
                    } else {
                        setColumnVisibility(index, false);
                        setting.visible = false;
                    }

                    if (columnChanged) {
                        columnChanged();
                    }
                    $.setCookie(userId + "_" + tableKey, s, 99999);

                };

            }(s[i])
            );
            row[0].setting = s[i];
            row.append(checkbox);
            columncheckboxes = columncheckboxes.add(row);
        }
        for (var i = 0; i < length; i++) {
            for (var b = 0; b < length; b++) {
                if (i === s[b].index) { // index property represents the order of the column, start with 0 find column with that index, put it in place, continue on
                    divOrganizer.append(columncheckboxes[b]);
                }
            }
        }
        $.setCookie(userId + "_" + tableKey, s, 99999);


        setVisibility();
        if (columnChanged) {
            columnChanged();
        }
        setColumnPosition();

        columncheckboxes.setDraggable(function (d, t) {

            var bIndex = d[0].setting.index;
            var aIndex;
            img.remove();
            aIndex = t.target[0].setting.index;
            if (t.top) {
                t.target.before(d);
                moveColumns(bIndex, aIndex, false);
            }
            else if (t.bottom) {
                t.target.after(d);
                moveColumns(bIndex, aIndex, true);
            }

            targets = divOrganizer.find("div.column");
            var l = targets.length;
            while (l--) {
                targets[l].setting.index = l;
            }

            $.setCookie(userId + "_" + tableKey, s, 99999);


        }, function (t) {
            img.detach();
            if (t.top)
                t.target.before(img);
            else if (t.bottom)
                t.target.after(img);

        }, 200);

        return {
            container: divOrganizer, resetRows: function () {
                var m = $.metrics();
                tbodyRows = body.find("tbody tr");
                bodyColumns = [];
                for (i = 0; i < length; i++) { //for each column defined by the <th> 's - do stuff
                    bodyColumns.push(body.find("tbody>tr>td:nth-child(" + (i + 1) + ")")); //find all the <td>s at that index, and store them in a collection
                }

                for (i = 0; i < length; i++) { //for each column defined by the <th> 's - do stuff
                    if (!s[i].visible) {
                        if (!isIe8) {
                            bodyColumns[i].hide();
                        }
                        else {
                            $(bodyCols[i]).css("visibility", "collapse");
                        }
                    }
                }



                var l = bodyColumns.length;
                while (l--) {
                    bodyColumns[l].detach();
                }
                l = s.length;
                for (var i = 0; i < l; i++) {
                    for (var b = 0; b < l; b++) {
                        if (i === s[b].index) { // index property represents the order of the column, start with 0 find column with that index, put it in place, continue on
                            var tbodyl = tbodyRows.length;
                            while (tbodyl--) { // for each row, append the individual <td>s in order 
                                if (tbodyRows[tbodyl] && bodyColumns[b]) {
                                    $(tbodyRows[tbodyl]).append(bodyColumns[b][tbodyl]);
                                }
                            }
                        }
                    }
                }
                bodyColumns = [];
                for (i = 0; i < length; i++) {
                    bodyColumns.push(body.find("tbody>tr>td:nth-child(" + (i + 1) + ")"));
                }
                if (columnChanged) {
                    columnChanged();
                }
                console.log(m.time());
            }

        };

        //this is how the columns are setup the first time through- as opposed to movecolumn when one column is moved
        function setColumnPosition() {//the THS are getting out of order when a reset is done for paging WHY?
            ths.detach();
            headCols.detach();
            bodyCols.detach();
            var l = bodyColumns.length;
            while (l--) {
                bodyColumns[l].detach();
            }
            l = s.length;
            for (var i = 0; i < l; i++) {
                for (var b = 0; b < l; b++) {
                    if (i === s[b].index) { // index property represents the order of the column, start with 0 find column with that index, put it in place, continue on
                        headerRow.append(ths[b]);
                        headColGroup.append(headCols[b]);
                        bodyColGroup.append(bodyCols[b]);
                        var tbodyl = tbodyRows.length;
                        while (tbodyl--) { // for each row, append the individual <td>s in order 
                            if (tbodyRows[tbodyl] && bodyColumns[b]) {
                                $(tbodyRows[tbodyl]).append(bodyColumns[b][tbodyl]);
                            }
                        }
                    }
                }
            }
            resetCollections();
        }
        function resetCollections() {
            ths = head.find("th");
            headCols = head.find("colgroup col");
            bodyCols = body.find("colgroup col");
            length = bodyColumns.length;
            bodyColumns = [];
            for (i = 0; i < length; i++) {
                bodyColumns.push(body.find("tbody>tr>td:nth-child(" + (i + 1) + ")"));
            }
        }

        function init() {
            ths = head.find("th");
            length = ths.length
            bodyColumns = [];
            for (i = 0; i < length; i++) { //for each column defined by the <th> 's - do stuff
                bodyColumns.push(body.find("tbody>tr>td:nth-child(" + (i + 1) + ")")); //find all the <td>s at that index, and store them in a collection
            }
            headCols = head.find("colgroup col");
            bodyCols = body.find("colgroup col");
            tbodyRows = body.find("tbody tr");
            headerRow = head.find("thead tr");
            bodyColGroup = body.find("colgroup");
            headColGroup = head.find("colgroup");
        }

        function setVisibility() {
            for (i = 0; i < length; i++) { //for each column defined by the <th> 's - do stuff
                if (!s[i].visible) {
                    setColumnVisibility(i, false);
                }
            }
        }

        function setColumnVisibility(index, visible) {
            if (visible) {
                ths[index].visible = true;
                if (!isIe8) {
                    $(ths[index]).show();
                    bodyColumns[index].show();
                    $(headCols[index]).show();
                    $(bodyCols[index]).show();
                }
                else {
                    $(headCols[index]).css("visibility", "visible");
                    $(bodyCols[index]).css("visibility", "visible");
                }
            } else {
                ths[index].visible = false;
                if (!isIe8) {
                    $(ths[index]).hide();
                    bodyColumns[index].hide();
                    $(headCols[index]).hide();
                    $(bodyCols[index]).hide();
                }
                else {
                    $(headCols[index]).css("visibility", "collapse");
                    $(bodyCols[index]).css("visibility", "collapse");
                }
            }
        }

        function moveColumns(bIndex, aIndex, after) {
            var f = after ? $.fn.after : $.fn.before;

            $(ths[bIndex]).detach();
            bodyColumns[bIndex].detach();
            $(headCols[bIndex]).detach();
            $(bodyCols[bIndex]).detach();

            f.call($(ths[aIndex]), ths[bIndex]);
            f.call($(headCols[aIndex]), headCols[bIndex]);
            f.call($(bodyCols[aIndex]), bodyCols[bIndex]);


            var atds = bodyColumns[aIndex];
            var btds = bodyColumns[bIndex];
            if (atds && btds) {
                var l = atds.length;
                while (l--) {
                    f.call($(atds[l]), btds[l]);
                }
            }
            resetCollections(); //need to repolace this with just splicing the colleciton to be in the correct order instead of searching the dom for the order

        }
    }

    //factory method to return object that will manage year make model information, storing locally or getting from server based on source
    $.getYearMakeModelStore = function (options) {

        options = $.extend({
            companyId: 1,
            source: "edmunds"

        }, options)

        var sourceType = "edmunds", sources = ["nada", "blackbook", "manheim", "kbb", "galves", "edmunds", "nadaclassic"], dataStore, queryStringKeys
        queryStringKeys = { edmundsmake: "makeid", blackbookmake: "make", nadamake: "make", galvesmake: "make", kbbmake: "make", nadaclassicmake: "make" };

        var getAll = function (done) {
            $.getJSON(
                getMainPath() + "WebServices/ScriptingServices/Vehicle.ashx",
                { command: "getyearsmakesmodels", companyid: options.companyId, source: options.source },
                function (result) {
                    done(result);
                });
        }
        var getMakes = function (done) {

        }
        var ymm = function (done) {
            if (options.source !== "edmunds") {//hard code that only edmunds info currently can be retrieved all at once
                return false;
            }

            if (dataStore) {
                done(dataStore);
                return true;
            }
            //new edmunds data has different vehicle classes > need to create a new entry in localstorage and deprecate the old one
            $.removeItem(sourceType + "_eleadyearmakemodel");


            var l = $.getItem(sourceType + "_new_eleadyearmakemodel", function (data) {
                if (!data) {
                    getAll(function (data) {
                        $.setItem(sourceType + "_new_eleadyearmakemodel", data);
                        done(data);
                        dataStore = data;

                    });
                }
                else {
                    done(data);
                    dataStore = data;
                }
            });
            return l;
        }
        function findByYear(data, value, vClass) {
            var l = data.length;
            var retData = null;
            while (l--) {
                if (data[l].Key === value) {
                    if (data[l].Value)
                        retData = data[l];
                }
                //if (retData == null)
                //    retData = [];
            }
            if (vClass) {
                if (retData && retData.Value.length > 0)
                    retData = retData.Value.filter(function (vc) { return vc.Key == vClass.val(); })[0];
                else
                    retData = [];
            }

            return retData;
        }
        function findByMake(data, value, vclassElem) {
            var l = data.length;
            value = parseInt(value);
            while (l--) {
                if (data[l].Key.key === value) {
                    return data[l];
                }
            }
        }
        function normalizeMakes(data) {
            if (data) {
                var n = [], l = data.length;

                while (l--) {
                    n.push({ Key: data[l].Key.key, Value: data[l].Key.value });
                }
                return n.reverse();
            }
            else
                return null;
        }
        function normalizeModels(data) {
            var n = [], l = data.length;

            while (l--) {
                n.push({ Key: data[l].key, Value: data[l].value });
            }
            return n.reverse();
        }
        //check if datastore exists
        //if true return data
        //if false 
        return {
            getYears: function (done) {
                if (ymm(function (data) { //get from localstorage or check if possible
                    done(data);
                })) {

                }
                else { //get from server
                    $.getJSON(
                        getMainPath() + "WebServices/ScriptingServices/Vehicle.ashx",
                        { command: "getyears", companyid: options.companyId, source: options.source },
                        function (result) {
                            dataStore = result;
                            done(result);
                        });
                }

            },
            getMakes: function (done, year, vclassElem) {
                if (ymm(function (data) { //get from localstorage or check if possible
                    var d = findByYear(data, year, vclassElem);
                    if (d)
                        done(normalizeMakes(d.Value));
                    else
                        done([]);
                })) {

                }
                else { //get from server
                    $.getJSON(
                        getMainPath() + "WebServices/ScriptingServices/Vehicle.ashx",
                        { command: "getmakes", companyid: options.companyId, source: options.source, year: year },
                        function (result) {
                            done(result);
                            if (dataStore) {
                                // dataStore[year] = result;
                            }
                        });
                }
            },
            getModels: function (done, year, make, vclassElem) {
                if (ymm(function (data) { //get from localstorage or check if possible
                    var makes = findByYear(data, year, vclassElem).Value;
                    if (make != "Null") {
                        var models = findByMake(makes, make, vclassElem).Value
                        done(normalizeModels(models));
                    }
                })) {

                }
                else { //get from server
                    var cmd = {
                        command: "getmodels", companyid: options.companyId, source: options.source, year: year
                    };
                    cmd[queryStringKeys[options.source + "make"]] = make;
                    $.getJSON(
                        getMainPath() + "WebServices/ScriptingServices/Vehicle.ashx",
                        cmd,
                        function (result) {
                            done(result);
                            if (dataStore) {
                                //dataStore[year].Value[make] = result;
                            }
                        });
                }
            },
            getTrims: function (done, year, make, model, evdDetailedCommand) {
                var cmd = "getseries"
                //storing all trims in local storage is too much, just get async from server
                if (evdDetailedCommand)
                    cmd = evdDetailedCommand;

                $.getJSON(getMainPath() + "WebServices/ScriptingServices/Vehicle.ashx",
                    { command: cmd, companyid: options.companyId, source: options.source, year: year, make: make, model: model },
                    function (result) {
                        done(result);
                    });

            }

        };
    }
    //return if localstorage is possible, use callback function, perhaps async possibiliity in future
    $.getItem = function (key, done) {
        var item;
        if (('localStorage' in window) && window.localStorage !== null) {
            if (done) {
                item = localStorage.getItem(key);
                if (item) {
                    try {
                        item = JSON.parse(item);
                        done(item);
                    }
                    catch (err) {
                        done(item);
                    }
                }
                else {
                    done(item);
                }
            }
            return true;
        }
        return false;
    }
    $.setItem = function (key, value) {
        // if localStorage is present, use that
        if (('localStorage' in window) && window.localStorage !== null) {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        }
        return false;
    }
    $.removeItem = function (key) {
        if (('localStorage' in window) && window.localStorage !== null) {
            if (localStorage.getItem(key) != null)
                localStorage.removeItem(key);
        }
        return true;
    }

    $.getCookieObject = function (key) {
        var s = $.getCookie(key);
        if (s) {
            if (window.JSON) {
                console.log(window.JSON);
                console.log(s);
                try {
                    return JSON.parse(s);
                }
                catch (e) { }
            }
        } //accomodate some other way to parse perhaps?
        return null;

    }
    $.setCookie = function (c_name, c_value, exdays) {
        if (typeof c_value === "object") {
            if (window.JSON) {
                c_value = JSON.stringify(c_value);
            }
        }
        var exdate = new Date();
        exdate.setDate(exdate.getDate() + exdays);
        var c_value = escape(c_value) + ((exdays == null) ? "" : "; expires=" + exdate.toUTCString());
        document.cookie = c_name + "=" + c_value;


    }
    $.getCookie = function (c_name) {
        var i, x, y, ARRcookies = document.cookie.split(";");
        for (i = 0; i < ARRcookies.length; i++) {
            x = ARRcookies[i].substr(0, ARRcookies[i].indexOf("="));
            y = ARRcookies[i].substr(ARRcookies[i].indexOf("=") + 1);
            x = x.replace(/^\s+|\s+$/g, "");
            if (c_name == "UserID" && x.indexOf("UserInformation") > -1) {
                return x.replace("UserInformation%5F", "");
            }
            if (x == c_name) {
                return unescape(y);
            }
        }
    }
    $.saveUserSettings = function (key, value) {
        var u = $.getCookieObject("u");
        if (!u) {
            u = {};
        }
        u[key] = value;
        var s = JSON.stringify(u);
        $.setCookie("u", u);
        u = $.getCookie("u");
        if (s !== u) {//cookie to big

        }


    }
    $.MapText = function (comparer, comparees, ignoreCase) {
        var spaces = comparer.split(" ");
        if (spaces.length === 1)
            return mapTextOnSpaces(comparer, comparees, ignoreCase);
        else
            return mapTextOnConcat(comparer, comparees, ignoreCase);
    }
    function mapTextOnConcat(comparer, comparees, ignoreCase) {
        var cDistance = 0, i, c, l;
        var lswstIndex = 0;
        var maxDistance = 0;
        var comparisons = [];
        var comparerEntries = comparer.split(" ");
        l = comparees.length;
        for (i = 0; i < l; i++) {
            //if exact match then nothing else is needed
            if (ignoreCase) {
                if (comparees[i].toLowerCase() === comparer.toLowerCase())
                    return { Text: comparees[i], Index: i, Distance: [1] };
            }
            else {
                if (comparees[i] === comparer)
                    return { Text: comparees[i], Index: i, Distance: [1] };
            }
            var tc = {};
            tc.Distances = [];
            tc.Text = comparees[i];
            tc.Index = i;
            comparisons.push(tc);
            var compareeEntries = comparees[i].split(' ');
            comparer = comparer.replace(/\s/g, "");


            if (ignoreCase) {
                cDistance = levenshtein(comparer.toLowerCase(), comparees[i].replace(/\s/g, "").toLowerCase());
            }
            else {
                cDistance = levenshtein(comparer, comparees[i].replace(/\s/g, ""));
            }
            if (cDistance > maxDistance)
                maxDistance = cDistance;
            if (!tc.Distances[cDistance])
                tc.Distances[cDistance] = 1;
            else
                tc.Distances[cDistance] += 1;

        }

        return findIndex(comparisons, 0, maxDistance);
    }

    //given a comparer of one or more words possibly delimited by spaces, find the best match in the given array of strings possibly delimited by spaces
    //comparer = string
    //comparees = string array
    function mapTextOnSpaces(comparer, comparees, ignoreCase) {
        var cDistance = 0, i, c, l;
        var lswstIndex = 0;
        var maxDistance = 0;
        var comparisons = [];
        var comparerEntries = comparer.split(" ");
        l = comparees.length;
        for (i = 0; i < l; i++) {
            //if exact match then nothing else is needed
            if (ignoreCase) {
                if (comparees[i].toLowerCase() === comparer.toLowerCase())
                    return { Text: comparees[i], Index: i, Distance: [1] };
            }
            else {
                if (comparees[i] === comparer)
                    return { Text: comparees[i], Index: i, Distance: [1] };
            }
            var tc = {};
            tc.Distances = [];
            tc.Text = comparees[i];
            tc.Index = i;
            comparisons.push(tc);
            var compareeEntries = comparees[i].split(' ');
            for (c in comparerEntries) {
                for (var ce in compareeEntries) {
                    if (ignoreCase) {
                        cDistance = levenshtein(comparerEntries[c].toLowerCase(), compareeEntries[ce].toLowerCase());
                    }
                    else {
                        cDistance = levenshtein(comparerEntries[c], compareeEntries[ce]);
                    }
                    if (cDistance > maxDistance)
                        maxDistance = cDistance;
                    if (!tc.Distances[cDistance])
                        tc.Distances[cDistance] = 1;
                    else
                        tc.Distances[cDistance] += 1;

                }

            }

        }


        return findIndex(comparisons, 0, maxDistance);
    }
    //iterate from zero up
    //find the most occurances of the distance starting at zero
    //if no occurances have been found, continue to next distance 1,2,3...etc

    function findIndex(c, initial, max) {
        var maxCount = 0, d = initial;
        var currentComparisons = [];

        maxCount = 0;
        l = c.length;
        for (i = 0; i < l; i++) {
            if (c[i].Distances[d] && c[i].Distances.length > 0) {
                if (c[i].Distances[d] > 0) {
                    if (c[i].Distances[d] > maxCount) {
                        currentComparisons = [];
                        currentComparisons.push(c[i]);
                        maxCount = c[i].Distances[d];

                    }
                    else if (c[i].Distances[d] == maxCount) {
                        currentComparisons.push(c[i]);
                    }
                }
            }
        }
        if (currentComparisons.length > 1)
            return findIndex(currentComparisons, d + 1, max);
        else if (initial > max) {
            if (currentComparisons.length > 0)
                return currentComparisons[0];
            else if (c.length > 0)
                return c[0];

        }
        else if (currentComparisons.length === 1)
            return currentComparisons[0];
        else if (currentComparisons.length === 0)
            return findIndex(c, d + 1, max);


    }
    //http://webreflection.blogspot.com/2009/02/levenshtein-algorithm-revisited-25.html
    var levenshtein = function (a, b) {
        if (a == b) return 0;
        if (!a.length || !b.length) return b.length || a.length;
        var len1 = a.length + 1,
            len2 = b.length + 1,
            I = 0,
            i = 0,
            d = [[0]],
            c, j, J;
        while (++i < len2)
            d[0][i] = i;
        i = 0;
        while (++i < len1) {
            J = j = 0;
            c = a[I];
            d[i] = [i];
            while (++j < len2) {
                d[i][j] = Math.min(d[I][j] + 1, d[i][J] + 1, d[I][J] + (c != b[J]));
                ++J;
            };
            ++I;
        };
        return d[len1 - 1][len2 - 1];
    }
    //populate year make model trim... drop downs
    //s = {source:edmunds,year:y,make:m,model:mm,trim:t,body:b,companyId:1}
    $.populateVehicleSelector = function (s) {

        s = $.extend({
            companyId: 1,
            source: "edmunds",
            yearSelected: function (v, t) { },
            classSelected: function (v, t) { },
            makeSelected: function (v, t) { },
            modelSelected: function (v, t) { },
            trimSelected: function (v, t) { },
            bodySelected: function (v, t) { },
            extendedTrimOptions: {
                returnDetailedTrims: undefined, //this is a function to execute when returning EVD detailed trims
                trimCommandToUse: undefined,
            }

        }, s)


        //only select elements are supported now - exit if not present
        if ((s.year && s.year.length > 0 && s.year[0].nodeName !== "SELECT")
            || s.make && s.make.length > 0 && s.make[0].nodeName !== "SELECT"
            || s.model && s.model.length > 0 && s.model[0].nodeName !== "SELECT"
        ) {
            return;
        }
        var ymms = $.getYearMakeModelStore({ companyId: s.companyId, source: s.source });


        function empty() {
            var ss = arguments, l = ss.length
            while (l--) {
                if (ss[l])
                    ss[l].empty();
            }
        }
        function disable() {
            var ss = arguments, l = ss.length
            while (l--) {
                if (ss[l])
                    ss[l].disable();
            }
        }

        var classChangedHandler = function (make, model, trim, body) {
            if (s.year.val() != "0") {
                s.classSelected(s.vehicleClass.val(), s.vehicleClass.children(":selected").text());
                empty(s.model, s.trim, s.body);
                disable(s.model, s.trim, s.body);
                s.make.empty();
                ymms.getMakes(function (data) {
                    if (!data || data.length === 0) {
                        return;
                    }

                    data[0].Value === "" ? data[0].Value = "--Select--" : data.splice(0, 0, { Key: "--Select--", Value: "--Select--" });
                    s.make.buildDropdown(data, "Value", selectmakevalue);
                    s.make.appendDropdown("Other", "Null", false);
                    s.make.enable();
                    if (make) {
                        s.make.val(make);
                        s.make.enable();
                        if (model)
                            makeChangedHandler(model, trim, body);
                    }
                }, s.year.val(), s.vehicleClass
                );

            }
        };

        var yearChangedHandler = function (make, model, trim, body) {
            var vClass = "";
            if (s.vehicleClass)
                vClass = s.vehicleClass.children(":selected").val();

            s.yearSelected(s.year.val(), s.year.children(":selected").text(), vClass);
            empty(s.model, s.trim, s.body);
            disable(s.model, s.trim, s.body);
            ymms.getMakes(function (data) {
                if (!data || data.length === 0) {
                    s.make.disable();
                    return;
                }

                data[0].Value === "" ? data[0].Value = "--Select--" : data.splice(0, 0, { Key: "--Select--", Value: "--Select--" });
                s.make.buildDropdown(data, "Value", selectmakevalue);
                s.make.appendDropdown("Other", "Null", false);
                s.make.enable();
                if (make) {
                    s.make.val(make);
                    s.make.enable();
                    if (model)
                        makeChangedHandler(model, trim, body);
                }
            }, s.year.val(), s.vehicleClass
            );
        };
        var makeChangedHandler = function (model, trim, body) {
            var makeValue = s.source === "edmunds" ? s.make.val() : s.make.children(":selected").text();
            s.makeSelected(s.make.val(), s.make.children(":selected").text());
            disable(s.model, s.trim, s.body);
            empty(s.trim, s.body);
            ymms.getModels(function (data) {
                if (!data || data.length === 0) { return; }
                data[0].Value === "" ? data[0].Value = "--Select--" : data.splice(0, 0, { Key: "--Select--", Value: "--Select--" });
                s.model.buildDropdown(data, "Value", "Value");
                s.model.enable();
                if (model) {
                    s.model.val(model);
                    s.model.enable();
                    if (trim)
                        modelChangedHandler(trim, body);
                }
            }, s.year.val(), makeValue, s.vehicleClass
            );

        };
        var modelChangedHandler = function (trim, body) {
            var makeValue = s.source === "edmunds" ? s.make.children(":selected").text() : s.make.val();
            var trimKey = s.source === 'kbb' ? 'Key' : 'Value';
            s.modelSelected(s.model.val(), s.model.children(":selected").text());
            disable(s.trim, s.body);
            empty(s.body);
            ymms.getTrims(
                function (data) {
                    var trimData = s.extendedTrimOptions.returnDetailedTrims ? data.Trims : data;
                    if (!trimData || trimData.length === 0) { return; }


                    trimData[0].Value === "" ? trimData[0].Value = "--Select--" : trimData.splice(0, 0, { Key: "--Select--", Value: "--Select--" });

                    s.trim.buildDropdown(trimData, "Value", trimKey);

                    s.trim.enable();
                    if (trim) {
                        s.trim.val(trim);
                        s.trim.enable();
                        if (body) {
                            trimChangedHandler(body);
                        }
                    }
                    else if (s.trim.children("option").length === 1) { //auto select the only choice there is
                        s.trim.children("option").eq(0).attr('selected', 'selected');
                        s.trim.disable();
                        trimChangedHandler(body);
                    }
                    else if (s.trim.children("option").length === 2) { //auto select the only choice there is
                        s.trim.children("option").eq(1).attr('selected', 'selected');
                        trimChangedHandler(body);
                    }

                    if (s.extendedTrimOptions.returnDetailedTrims && typeof (s.extendedTrimOptions.returnDetailedTrims) == "function")
                        s.extendedTrimOptions.returnDetailedTrims(data);

                },
                s.year.val(), makeValue, s.model.val(), s.extendedTrimOptions.commandToUse
            );

        }

        var trimChangedHandler = function (body, e) {
            s.trimSelected(s.trim.val(), s.trim.children(":selected").text(), e);
            if (!s.body)
                return;

            s.body.disable();
            s.body.empty();
            $.getJSON(getMainPath() + "WebServices/ScriptingServices/Vehicle.ashx?&companyid="
                + s.companyId + "&command=getbodystyle&r=" + Math.random() + "&" + "source=" + s.source + "&year=" + s.year.val() + "&make=" + s.make.val() + "&model=" + s.model.val() + "&series=" + s.trim.val()
                , function (data) {
                    data[0].Value === "" ? data[0].Value = "--Select--" : data.splice(0, 0, { Key: "--Select--", Value: "--Select--" });
                    s.body.buildDropdown(data, "Value", "Value");
                    s.body.enable();
                    if (body) {
                        s.body.val(body);
                        s.body.enable();
                        s.body.change();
                    }
                    else if (s.body.children("option").length === 1) { //auto select the only choice there is
                        s.body.children("option").eq(0).attr('selected', 'selected');
                        s.body.disable();
                        s.body.change();
                    }
                    else if (s.body.children("option").length === 2) { //auto select the only choice there is
                        s.body.children("option").eq(1).attr('selected', 'selected');
                        s.body.change();
                    }
                }
            );

        };



        function getYears(f) {
            $.getJSON(getMainPath() + 'WebServices/ScriptingServices/Vehicle.ashx',
                { companyid: s.companyId, command: 'getvehicleyears', source: s.source }
                , f
            );
        }
        if (s.year && s.year.children().length === 0) {
            getYears(function (data) {
                s.year.buildDropdown(data, "Value", "Value", "--Select--", null, "--Select--");

            });
        }

        if (s.year) {
            var selectmakevalue = s.source === "edmunds" ? "Key" : "Value";
            s.year.change(function () {
                yearChangedHandler();
            });
        }

        if (s.vehicleClass) {
            console.log(s.vehicleClass);
            s.vehicleClass.change(function () {
                classChangedHandler();
            });
        }

        if (s.make) {
            s.make.change(function () { makeChangedHandler(); });
            if (s.make.children().length === 0) {
                s.make.disable();
            }
        }
        if (s.model) {
            s.model.change(function () { modelChangedHandler(); });
            if (s.model.children().length === 0) {
                s.model.disable();
            }
        }

        if (s.trim) {
            s.trim.change(function (e) { trimChangedHandler(null, e); s.trim.enable() });
            if (s.trim.children().length === 0) {
                s.trim.disable();
            }
        }
        if (s.body) {//nothing to do when body changes except call done
            if (s.body.children().length === 0) {
                disable(s.body);
            }
            s.body.change(function (e) {
                s.bodySelected(s.body.val(), s.body.children(":selected").text(), e);
                s.body.enable();
            });
        }



        return {
            setVin: function (vin, done) {

                var source = s.source === "nada" ? "nadavinexplode" : "bbvinexplode";
                var yearField = s.source === "nada" ? "VicYear" : "YearCode";

                //hard code currently for edmunds, its only use is to populate trim by vin
                //change if year/make/model are needed in the future
                if (s.source === "edmunds") {

                    //gettrims
                    //vin
                    $.getJSON(getMainPath() + 'WebServices/ScriptingServices/Vehicle.ashx',
                        { companyid: s.companyId, command: 'gettrims', vin: vin }
                        , function (data) {

                            data = data.Items || data;
                            if (data && data.length > 0) {
                                s.trim.buildDropdown(data, "Value", "Value");
                            }

                        }
                    );
                }
                else {
                    $.getJSON(getMainPath() + "WebServices/ScriptingServices/Vehicle.ashx?&companyid="
                        + s.companyId + "&command=" + source + "&r=" + Math.random() + "&" + "&vin=" + vin
                        , function (data) {
                            data = data.Items || data;
                            if (data && data.length > 0) {
                                s.year.val(data[0][yearField]);
                                yearChangedHandler(data[0].Make, data[0].Model, data[0].Series, data[0].BodyStyle);
                            }

                        }
                    );
                }
            }
        }

    }

    ///sync the values of a group of <select> elements to the same value as close as possible
    //s = the originating select
    //exc = array of words to exclude from comparison(not implemented yet);
    //arguments = the group of select elements to sync
    $.syncSelects = function (s, exc, ic) {
        var o, ss = Array.prototype.slice.call(arguments, 0, arguments.length), text = [], l = ss.length, ol, bestMatch, disable;
        if (typeof s.change === 'function') {
            s.change(function (e) {
                sync();
            });
        }
        function sync() {
            if (disable)
                return;
            l = ss.length;
            var txtToMatch = typeof s === 'string' ? s : s.find("option:selected").text(); //assuming passing in a string to match or a Select element to match on the selected value;
            syncLoop:
            while (l--) {
                if (l === 2)//0,1,2 index are not valid
                    break syncLoop;
                if (s[0] != ss[l][0])//dont perform sync on the originating element
                {
                    text = [];
                    o = ss[l].find("option");
                    ol = o.length;
                    while (ol--) {
                        text.push(o[ol].text);
                    }
                    bestMatch = $.MapText(txtToMatch, text, ic);
                    ol = o.length;
                    while (ol--) {
                        if (o[ol].text === bestMatch.Text) {
                            ss[l][0].selectedIndex = ol;
                            ss[l].change();
                            break;
                        }
                    }

                }
            }
        }
        function clear() {
            var l = ss.length;
            //clear all instances for synced elements
            syncLoop:
            while (l--) {
                if (l === 2)
                    break syncLoop;

                if (s[0] != ss[l][0] && ss[l][0] != undefined) {
                    //set selectedIndex = 0
                    ss[l][0].selectedIndex = 0;
                    //need to trigger the change
                    ss[l].change();
                }
            }
        }
        return { sync: sync, enable: function () { disable = false; }, disable: function () { disable = true; }, add: function (dd) { ss.push(dd); }, clear: clear };
    }

    $.makeEmailLinks = function () {
        var tNodes = [];
        //URLs starting with http://, https://
        var exp = /(?:(?:(?:https?|s?ftps?|mailto):)?\/\/)(?:\S+(?::\S*))?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z0-9\u00a1-\uffff][a-z0-9\u00a1-\uffff_-]{0,62})?[a-z0-9\u00a1-\uffff]\.)+(?:[a-z\u00a1-\uffff]{2,}\.?))(?::\d{2,5})?(?:[/?#]\S*)?/gmi;
        getTextNodes(document.body, false, tNodes, exp);
        var l = tNodes.length;
        while (l--) {
            if ($(tNodes[l]).parent()[0].nodeName !== "A") {
                tNodes[l].nodeValue = $.trim(tNodes[l].nodeValue);
                wrapNodeURL(tNodes[l], exp, '<a href="$&" style="display:inline-block;max-width:500px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;text-align:bottom;padding:0;vertical-align:bottom;" target=\"_blank\">$&</a>');
            }
        }
    }

    function getURl(url) {
        var _location = document.location.toString();
        var applicationNameIndex = _location.indexOf(
            "/",
            _location.indexOf("://") + 3
        );
        var applicationName = _location.substring(0, applicationNameIndex) + "/";
        var webFolderIndex = _location.indexOf(
            "/",
            _location.indexOf(applicationName) + applicationName.length
        );
        var BaseURL = _location.substring(0, webFolderIndex);
        return BaseURL + url;
    }


    $.appendBrandStyles = function () {
        var childCompanyId = "undefined";
        if (childCompanyId == "undefined" && typeof (Storage) !== "undefined") {
            childCompanyId = window.sessionStorage.getItem("childCompanyID");
        }
        if (childCompanyId == "undefined" && typeof (URLSearchParams) !== "undefined") {
            var urlParams = new URLSearchParams(window.location.search);
            childCompanyId = urlParams.get("CompanyID"); // Credit App is external facing passes the Company in the QS
        }

        var userId = "undefined";
        if (userId == "undefined" && typeof (Storage) !== "undefined") {
            userId = window.sessionStorage.getItem("userId");
        }

        var defaultBrandId = "undefined";
        if (defaultBrandId == "undefined" && typeof (Storage) !== "undefined") {
            defaultBrandId = window.sessionStorage.getItem("defaultBrandId");
        }

        var currentBrandId = "undefined";
        if (currentBrandId == "undefined" && typeof (Storage) !== "undefined") {
            currentBrandId = window.sessionStorage.getItem("currentBrandId");
        }

        //var productId = "undefined";
        //if (productId == "undefined" && typeof (Storage) !== "undefined") {
        //    productId = window.sessionStorage.getItem("productId");
        //}

        if (childCompanyId !== "undefined") {
            if (typeof (Storage) !== "undefined") {
                if (defaultBrandId === currentBrandId && window.sessionStorage.getItem(currentBrandId) !== null) {
                    $.loadDefaultStyle();
                }
                //else if (userId != 0 && defaultBrandId != 0 && currentBrandId != 0 && productId != 0) {
                //    if (window.sessionStorage.getItem(currentBrandId) === null) {
                //        $.getUserBrandStyle(childCompanyId, userId, defaultBrandId, currentBrandId, productId);
                //    }

                //}
                else {
                    if (sessionStorage.getItem(currentBrandId) === null) {
                        $.getBrandStyle(childCompanyId, currentBrandId);
                    }
                }

                $.loadStyle(window.sessionStorage.getItem(currentBrandId), window.sessionStorage.getItem(currentBrandId + "Image"));
            } else {
                // Sorry! No Web Storage support.. 
                $.getBrandStyle(childCompanyId, currentBrandId);
                return;
            }
        }
    };

    $.getBrandStyle = function (childCompanyId, currentBrandId) {
        if (childCompanyId === null) {
            return;
        }
        var d = {
            "CompanyId": childCompanyId, "ApplicationBrandId": currentBrandId
        };

        $.post(getURl("/api/BrandingCSS/GetBrandingCSS"), d, function (data) {
            if (data) {
                $.loadStyle(data.BrandCSS, data.BrandImageUrl);
                if (typeof (Storage) !== "undefined") {
                    window.sessionStorage.setItem(currentBrandId, data.BrandCSS);
                    window.sessionStorage.setItem(currentBrandId + 'Image', data.BrandImageUrl);
                }
                else {
                    $.setCookie(currentBrandId, data.BrandCSS);
                    $.setCookie(currentBrandId + 'Image', data.BrandImageUrl);
                }
            }
        }
        );
    };

    //$.getUserBrandStyle = function (childCompanyId, userId, defaultBrandId, currentBrandId, productId) {
    //    if (childCompanyId === null) {
    //        return;
    //    }

    //    var d = {
    //        "CompanyId": childCompanyId, "UserId": userId, "ProductId": productId, "DefaultBrandId": defaultBrandId, "ApplicationBrandId": currentBrandId
    //    };
    //    $.post(getURl("/api/BrandingCSS/GetBrandingCSS"), d,
    //        function (data) {
    //            if (data) {
    //                $.loadStyle(data.BrandCSS, data.BrandImageUrl);
    //                if (typeof (Storage) !== "undefined") {
    //                    window.sessionStorage.setItem(currentBrandId, data.BrandCSS);
    //                    window.sessionStorage.setItem(currentBrandId + 'Image', data.BrandImageUrl);
    //                }
    //                else {
    //                    $.setCookie(currentBrandId, data.BrandCSS);
    //                    $.setCookie(currentBrandId + 'Image', data.BrandImageUrl);
    //                }
    //            }
    //        }
    //    );
    //};

    $.loadDefaultStyle = function () {
        if ($("#BrandOverride") !== undefined)
            $("#BrandOverride").remove();
    };

    $.loadStyle = function (css, image) {
        if ($("#BrandOverride") !== undefined)
            $("#BrandOverride").remove();
        var styleBlock = document.createElement("style");
        styleBlock.id = "BrandOverride";
        styleBlock.type = "text/css";
        styleBlock.innerHTML = css;
        if ($("#imageProduct").attr("src") !== undefined && $("#imageProduct").prop("src") !== "") {
            $("#imageProduct").prop("src", image !== "" ? image : "/Evo2/Content/images/cdkglobal_wm_blk.png");
        }

        var head = document.head || document.getElementsByTagName("head")[0];
        if ($("#PlaceBrandStyleHere").length) {
            $("#PlaceBrandStyleHere").append(styleBlock);
        } else {
            $(head).append(styleBlock);
        }
    };

    $.appendBrandStyles();
    $.makePhoneLinks = function () {
        var pageUrl = self.location.href.toLowerCase();

        // if already on the click-to-call page or on the email editor page (templates.asp), then do not perform logic to highlight phone links
        if (pageUrl.indexOf("clicktocall/processcall.aspx") > 0 || pageUrl.indexOf("weblink/template") > 0 || pageUrl.indexOf("creditapplication/index.aspx") > 0 || pageUrl.indexOf("textmessaging/sendtextmessage.aspx") > 0 || pageUrl.indexOf("admin/preferences") > 0)
            return;

        var val = "" + $.getCookie("c2c");
        var handleClickToCallPermission = function (data) {

            if (data === "true") {
                var tNodes = [];
                var AppleHack = "";

                if (navigator.userAgent.match(/iP/i) != null) {
                    $('head').append('<meta http-equiv="name="format-detection" content="telephone=no" /> ');
                    AppleHack = "<img src='" + getMainPath() + "images/OpptyDetail_Phone.gif' alt='Click to Call' style='height: 14px; width: 16px; margin-top: -4px; margin-left: 4px;' />";
                }

                getTextNodes(document.body, false, tNodes, /(((\(\d{3}\) ?)|(\d{3}-))\d{3}-\d{4})/ig);
                var l = tNodes.length;

                while (l--) {
                    if ($(tNodes[l]).parent() == null || $(tNodes[l]).parent()[0].nodeName == "A" && $(tNodes[l]).parent()[0].href.substring(0, 4).toLowerCase() == "tel:") {
                        $($(tNodes[l]).parent()[0]).attr("href", "#");
                        $($(tNodes[l]).parent()[0]).attr("target", "_blank");
                        $($(tNodes[l]).parent()[0]).append(AppleHack);
                        $($(tNodes[l]).parent()[0]).click(function () {
                            $.Click2Call($(this).text()); return false;
                        });
                    }
                    //Look for Common Form Values
                    var task = ($("[name=lTaskID]").val() != undefined ? $("[name=lTaskID]").val() : "null");
                    task = (task == "null" && $("[name=tid]").val() != undefined ? $("[name=tid]").val() : task);
                    task = (task == "null" && $("[name=ltid]").val() != undefined ? $("[name=ltid]").val() : task);

                    var deal = ($("[name=lDealID]").val() != undefined ? $("[name=lDealID]").val() : "null");
                    deal = (deal == "null" && $("[name=did]").val() != undefined ? $("[name=did]").val() : deal);
                    deal = (deal == "null" && $("[name=ldid]").val() != undefined ? $("[name=dpid]").val() : deal);

                    var person = ($("[name=lPersonID]").val() != undefined ? $("[name=lPersonID]").val() : "null");
                    person = (person == "null" && $("[name=pid]").val() != undefined ? $("[name=pid]").val() : person);
                    person = (person == "null" && $("[name=lpid]").val() != undefined ? $("[name=lpid]").val() : person);

                    var company = "null";
                    var user = "null";

                    //Regex Look for Task, Deal, Person on the same <TR>, should be right... Think Organizer, Elead Today, Dashboards
                    var taskIDQueryRegex = /(taskid=)(\d*)/;
                    var personIDQueryRegex = /(lpid=)(\d*)/;
                    var dealIDQueryRegex = /(ldid=)(\d*)/;
                    var companyIDQueryRegex = /(licid=)(\d*)/;
                    var userIDQueryRegex = /(liuid=)(\d*)/;

                    task = (task == "null" && self.location.href.toLowerCase().indexOf("taskid=") > 0 ? taskIDQueryRegex.exec(self.location.href.toLowerCase())[2] : task)
                    deal = (deal == "null" && self.location.href.toLowerCase().indexOf("ldid=") > 0 ? dealIDQueryRegex.exec(self.location.href.toLowerCase())[2] : deal)
                    person = (person == "null" && self.location.href.toLowerCase().indexOf("lpid=") > 0 ? personIDQueryRegex.exec(self.location.href.toLowerCase())[2] : person)
                    company = (company == "null" && self.location.href.toLowerCase().indexOf("licid=") > 0 ? companyIDQueryRegex.exec(self.location.href.toLowerCase())[2] : company)
                    user = (user == "null" && self.location.href.toLowerCase().indexOf("liuid=") > 0 ? userIDQueryRegex.exec(self.location.href.toLowerCase())[2] : user)

                    task = (task == "null" && $(tNodes[l]).closest("tr").length > 0 && $(tNodes[l]).closest("tr").html().toLowerCase().indexOf("taskid=") > 0 ? taskIDQueryRegex.exec($(tNodes[l]).closest("tr").html().toLowerCase())[2] : task)
                    deal = (deal == "null" && $(tNodes[l]).closest("tr").length > 0 && $(tNodes[l]).closest("tr").html().toLowerCase().indexOf("ldid=") > 0 ? dealIDQueryRegex.exec($(tNodes[l]).closest("tr").html().toLowerCase())[2] : deal)
                    person = (person == "null" && $(tNodes[l]).closest("tr").length > 0 && $(tNodes[l]).closest("tr").html().toLowerCase().indexOf("lpid=") > 0 ? personIDQueryRegex.exec($(tNodes[l]).closest("tr").html().toLowerCase())[2] : person)
                    company = (company == "null" && $(tNodes[l]).closest("tr").length > 0 && $(tNodes[l]).closest("tr").html().toLowerCase().indexOf("licid=") > 0 ? companyIDQueryRegex.exec($(tNodes[l]).closest("tr").html().toLowerCase())[2] : company)
                    user = (user == "null" && $(tNodes[l]).closest("tr").length > 0 && $(tNodes[l]).closest("tr").html().toLowerCase().indexOf("liuid=") > 0 ? userIDQueryRegex.exec($(tNodes[l]).closest("tr").html().toLowerCase())[2] : user)

                    //null out empty strings
                    task = (task == "" ? "null" : task);
                    deal = (deal == "" ? "null" : deal);
                    person = (person == "" ? "null" : person);
                    company = (company == "" ? "null" : company);
                    user = (user == "" ? "null" : user);
                    if ($(tNodes[l]).parent() == null || $(tNodes[l]).parent()[0].nodeName != "A" || $(tNodes[l]).hasClass("c2cIgnore"))
                        wrapNode(tNodes[l], /(((\(\d{3}\) ?)|(\d{3}-))\d{3}-\d{4})/ig, "<a href='#' target=\"_blank\" onclick=\"$.Click2Call($(this).text(), " + task + ", " + deal + ", " + person + ", " + company + ", " + user + "); return false;\">$1" + AppleHack + "</a>");
                }
            }
        }; // end handleClickToCallPermission

        if (!$.getCookie("BackUpEmpID") || val.split("c")[0] != $.getCookie("BackUpEmpID")) {
            $.get(
                getMainPath() + "IncludeFiles/PermissionBridge.aspx?Type=Permission&Value=CanClickToCall&UID=" + $.getCookie("BackUpEmpID") + "&CID=" + $.getCookie("BackUpCompanyID"),
                function (data) {
                    if (data) {
                        handleClickToCallPermission(data);
                        $.setCookie("c2c", encodeURI($.getCookie("BackUpEmpID")) + "c" + data.toLowerCase());
                    }
                }
            );
        }
        else {
            handleClickToCallPermission(val.split("c")[1]);
        }
    }
    $.Click2Call = function (number, task, deal, person, company, user) {
        task = "&lTID=" + task;
        deal = "&lDID=" + deal;
        person = "&lPID=" + person;
        company = "&lICID=" + company;
        user = "&lIUID=" + user;
        $.popup(getMainPath() + 'ClickToCall/ProcessCall.aspx?Phone=' + number + task + deal + person + company + user, "Calling", 350, 330, true, true, true);
    }
    function getTextNodes(node, includeWhitespaceNodes, textNodes, match) {
        if (node != null && !$(node).hasClass("c2cIgnore")) {
            if (node.nodeType == 3) {
                if (includeWhitespaceNodes || !/^\s*$/.test(node.data)) {
                    if (match && node.data) {
                        if (node.data.match(match))
                            textNodes.push(node);
                    }
                    else {
                        textNodes.push(node);
                    }
                }
            } else {
                var l = node.childNodes.length;
                while (l--) {
                    getTextNodes(node.childNodes[l], includeWhitespaceNodes, textNodes, match);
                }
            }
        }
    }
    function iterateNodes(f, node) {
        if (node) {
            f(node);
        }
        else
            return;
        if (node.childNodes) {
            var l = node.childNodes.length;
            while (l--) {
                iterateNodes(node.childNodes[l]);
            }
        }

    }
    //    //given a set of elements, find all text nodes
    //    //format the text nodes as desired
    //    $.fn.format = function(){
    //        this.each(function() {
    //		    var tNodes = [];
    //            getTextNodes(this, false, tNodes);
    //            var l = tNodes.length;
    //            while (l--) {
    //                var d = tNodes[l].data;
    //                if ($.trim(d).match(^\d+$/)){
    //                    textNodes.push(node);
    //                }
    //            }
    //	    });
    //    }
    function wrapNode(n, match, m) {

        var temp = document.createElement('div');
        if (n.data)
            temp.innerHTML = n.data.replace(match, m);
        else {
            //whatever
        }
        while (temp.firstChild) {
            n.parentNode.insertBefore(temp.firstChild, n);

        }
        n.parentNode.removeChild(n);

    }

    function wrapNodeURL(n, match, m) {
        var temp = document.createElement('div');
        if (n.data) {
            if (!(n.data).match(/<a\s+(?:[^>]*?\s+)?href/)) {
                if ((n.data).match(/((https?|http|mailto):\/\/)/ig))
                    temp.innerHTML = n.data.replace(match, m);
                else {
                    m = "<a href='http://$&' target='_blank'>$&</a>"
                    temp.innerHTML = n.data.replace(match, m);
                }
            }
            else
                temp.innerHTML = n.data;


            while (temp.firstChild) {
                n.parentNode.insertBefore(temp.firstChild, n);
            }
            n.parentNode.removeChild(n);

        }
    }

    ///need to get rid of this at some point
    $.fn.buildVehicleDropDowns = function (make, model, succeedFunction, companyId, year, makeText, modelText, type, series, seriesText) {

        objectHash[HK_YEAR] = year;
        objectHash[HK_MAKE] = makeText;
        objectHash[HK_MODEL] = modelText;

        var YearChangeFuncHandler = function () {
            yearValue = this.value;
            $.get(mainPath + "WebServices/ScriptingServices/Vehicle.ashx", { year: yearValue, makeid: this.value, command: "getmakes", source: type, companyid: companyId }
                , function (data) {
                    make.buildDropdown(data, "Value", "Key", "--Select--", "", "");
                    if (objectHash[HK_MAKE]) {
                        make.selectOptionByText(objectHash[HK_MAKE]);
                        if (objectHash[HK_MODEL])
                            make.change();
                        else if (succeedFunction)
                            succeedFunction();
                    }
                }, "json")
        };

        var MakeChangeFuncHandler = function () {
            $.get(mainPath + "WebServices/ScriptingServices/Vehicle.ashx", { year: yearValue, makeid: this.value, command: "getmodels", source: type, companyid: companyId }
                , function (data) {
                    model.buildDropdown(data, "Value", "Key", "--Select--", "", "");
                    if (objectHash[HK_MODEL]) {
                        model.selectOptionByText(objectHash[HK_MODEL]);
                        //if (seriesText)
                        model.change();
                        if (succeedFunction)
                            succeedFunction();
                    }
                }, "json")
        };

        var ModelChangeFuncHandler = function () {
            $.get(mainPath + "WebServices/ScriptingServices/Vehicle.ashx", { year: yearValue, makeid: this.value, command: "getseries", source: type, companyid: companyId }
                , function (data) {
                    model.buildDropdown(data, "Value", "Key", "--Select--", "", "");
                    if (modelText) {
                        model.selectOptionByText(modelText);
                    }
                }, "json")
        };

        /*
        called on the year drop down
        check current context to determine if it is a drop down and if that drop down is populated
        if its already populated - perhaps from server - then determine if its set to the value as provided , if so populate make, else set value then populate make
        register change events
        Currently coded to assume year is populated and assigned to the desired year - need to change this later
        */
        if (!type)
            type = "edmunds";

        var yearValue = this.val();
        var makeValue = make.val();
        var mainPath = getMainPath();

        $('#year').on('change', YearChangeFuncHandler);
        $('#make').on('change', MakeChangeFuncHandler);
        if (series)
            $("#model").on('change', ModelChangeFuncHandler);

        if (year)
            this.val(year);

        if (makeText)
            this.change();
        //make.val(makeText);

        //if (modelText)
        //    model.val(modelText);

        else if (succeedFunction)
            succeedFunction();
    }




    $.validateVin = function valvin(serie) {

        var vinletters = new Array();
        vinletters[1] = "AJ";
        vinletters[2] = "BKS";
        vinletters[3] = "CLT";
        vinletters[4] = "DMU";
        vinletters[5] = "ENV";
        vinletters[6] = "FW";
        vinletters[7] = "GPX";
        vinletters[8] = "HY";
        vinletters[9] = "RZ";

        //--------------12345678901234567
        var vinweight = "8765432T098765432";

        serie = serie.toUpperCase();
        if (serie.length == 17) {
            suma = 0;
            for (i = 0; i < serie.length; i++) {
                nextchar = serie.charAt(i);
                for (j in vinletters) {
                    if (vinletters[j].indexOf(nextchar) != -1) {
                        nextchar = j;
                    }
                }
                val = parseInt(nextchar);
                weight = vinweight.charAt(i);
                if (weight == "T") {
                    weight = 10;
                } else {
                    weight = parseInt(weight);
                }
                suma += val * weight;
            }
            controlchar = suma % 11;
            if (controlchar == 10) controlchar = "X";
            if (controlchar == serie.charAt(8)) {
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
        return false;
    }


    $.searchVin = function (companyId, companyChildId, vin, done) {

        //should never get here without a vin but adding test to just make sure
        if (vin != "" && vin.length > 0) {
            $.post(getMainPath() + "WebServices/ScriptingServices/functions.ashx?"
                + "cmd=getownedvehiclebyvin"
                + "&r=" + Math.random()
                + "&childid=" + companyChildId
                + "&companyid=" + companyId,
                vin,
                function (data) {
                    var l, oa, o, i;
                    if (data && data.length > 0) {
                        if (data[0].length > 0)
                            i = data[0][0];
                    }
                    if (data && data.length > 1) {
                        if (data[1].length > 0) {
                            var app = $.sortArray(data[1], "dtAppraised", "Date", "desc");
                            oa = app[0];
                        }
                    }
                    if (data && data.length > 2) {
                        if (data[2].length > 0)
                            o = data[2][0];
                    }

                    done({ appraisals: oa, sales: o, inventory: i });
                },
                'json');
        }
    }
    $.metrics = function (alert) {
        var start = new Date().getTime();
        return {
            time: function () { return new Date().getTime() - start; },
            restart: function () { start = new Date().getTime(); }
        };

    }

    $.sortArray = function (ary, field, fieldType, direction) {
        var equaller = direction === "asc" || !direction ? 1 : -1;
        if (fieldType == "Numeric") {
            ary = ary.sort(function (a, b) {
                return (parseInt((a[field] || 0)) - parseInt(b[field] || 0)) * equaller;
            });

        }
        else if (fieldType == "Decimal") {
            ary = ary.sort(function (a, b) {
                return (parseFloat((a[field] || 0)) - parseFloat(b[field] || 0)) * equaller;
            });
        }
        else if (fieldType == "Alpha") {

            ary = ary.sort(function (a, b) {
                return (a[field].localeCompare(b[field])) * equaller;
            });

        }
        else if (fieldType == "Date") {
            ary = ary.sort(function (a, b) {
                var date1 = Date.parse(a[field]);
                var date2 = Date.parse(b[field]);
                if (date1 > date2) return 1 * equaller;
                if (date1 < date2) return -1 * equaller;
                return 0;
            });
        }


        return ary;
    }
    $.fn.delaybind = function (event, fn, timeout, abort) {
        var timer = null, cf = true;

        $(this).bind(event, function (e) {
            cf = true;
            var ev = e;
            var that = this;
            if (timer != null) {
                clearTimeout(timer);
            }
            timer = setTimeout(function () {
                if (cf) {
                    fn.call(that, ev);
                }
            }, timeout);
        });
        if (abort) {
            $(this).bind(abort, function () {
                if (timer != null) {
                    cf = false;
                    clearTimeout(timer);
                }
            });
        }
        return this;
    };

    //position one element relative to another elemen in an absolute manner
    $.fn.positionAbsolute = function (elm, pos1, pos2) {

        var y = this.offset().top - $(window).scrollTop(), x = this.offset().left - $(window).scrollLeft(), height1 = this.outerHeight(true), width1 = this.outerWidth(true), top, left,
            height2 = elm.outerHeight(true), width2 = elm.outerWidth(true);
        if (elm.parent && elm.parent().length === 0)
            $(document).append(elm);

        if (pos1 === 'topleft') {
            top = (y); left = x;
        }
        if (pos1 === 'topmiddle') {

        }
        if (pos1 === 'topright') {

        }
        if (pos1 === 'bottomleft') {
            top = (y + height1); left = x;
        }
        if (pos1 === 'bottommiddle') {

        }
        if (pos1 === 'bottomright') {

        }
        if (pos2 === 'topright') {
            left = left - elm.outerWidth();
        }
        if (pos2 === 'middleright') {
            left = left - elm.outerWidth();
            top = (top + height1 / 2) - height2 / 2;
        }

        elm.css({ position: 'fixed', top: top + 'px', left: left + 'px' });
        return this;

    }
    //the THs should have an attribute as: sortfields=[{"label":"Exterior Color","field":"Exterior Color","type":"Alpha"}]
    $.setTheadSort = function (headers, sortMenu, done, options) {
        var defaults = {
            position: 'bottomleft'
        }
        var options = $.extend(defaults, options);

        var currentHoveredTh, l = headers.length;

        while (l--) {
            var sortFields = $(headers[l]).attr('sortfields');
            try {
                sortFields = $.parseJSON(sortFields);
                //this is a stacked column
                $(headers[l]).click(function (e) {//this is whatever the icon should be to indicate stacked sorting column-make this better
                    if (currentHoveredTh === this && sortMenu.is(":visible")) {
                        sortMenu.css({ visibility: 'hidden' });
                        return
                    }

                    //skip if column isn't sortable
                    if (typeof ($(this).attr("sortfields")) != "string")
                        return;

                    currentHoveredTh = this;
                    var th = $(this);
                    createSortTable.call(th, e);
                    $(this).positionAbsolute(sortMenu, options.position);
                    sortMenu.css({ visibility: 'visible' });
                    sortMenu.hide();
                    sortMenu.slideDown(100).mouseleave(function (e) {
                        sortMenu.slideUp(100);
                        sortMenu.css({ visibility: 'hidden' });
                        return;
                    });

                });
            }
            catch (exp) {
                $(headers[l]).click(function (e) {

                    var sortFields = $(this).attr('sortfields'), direction;
                    try {
                        sortFields = $.parseJSON(sortFields);
                        return;
                    }
                    catch (exp) {
                    }

                    //skip if column isn't sortable
                    if (typeof ($(this).attr("sortfields")) != "string")
                        return;

                    headers.removeClass("headerSortDown").removeClass('headerSortUp');
                    sortMenu.find('*').removeClass("headerSortDown").removeClass('headerSortUp');
                    if (!$(this).data('sortdirection')) {
                        $(this).data('sortdirection', 'asc')
                        $(this).addClass("headerSortUp")
                        direction = 'asc';
                    }
                    else if ($(this).data('sortdirection') === "asc") {
                        $(this).data('sortdirection', 'desc')
                        $(this).addClass("headerSortDown");
                        direction = 'desc';
                    }
                    else if ($(this).data('sortdirection') === "desc") {
                        $(this).data('sortdirection', 'asc')
                        $(this).addClass("headerSortUp")
                        direction = 'asc';
                    }

                    done({ field: sortFields, type: $(this).attr("fieldType"), direction: direction });

                });
            }
        }

        function createSortTable(e) {
            var sortFields = $(this).attr('sortfields');
            try {
                sortFields = $.parseJSON(sortFields);

            }
            catch (exp) {
                return;
            }
            var currentTH = $(this);
            var sortField = currentTH.data('sortfield')
            var direction = currentTH.data('sortdirection');
            var sortClass = direction === "asc" ? "headerSortUp" : "headerSortDown";
            if (sortFields && sortFields.length > 1) {
                var optionhtml = "";
                optionhtml = "<table style=\"width:200px;\">";
                for (var i = 0; i < sortFields.length; i++) {

                    if (sortFields[i].field === sortField) {
                        optionhtml += ("<tr><td fieldtype='" + sortFields[i].type + "' sortfield='" + sortFields[i].field + "' class=\"" + sortClass + "\">" + sortFields[i].label + "</td></tr>");
                    }
                    else {
                        optionhtml += ("<tr><td  fieldtype='" + sortFields[i].type + "' sortfield='" + sortFields[i].field + "'>" + sortFields[i].label + "</td></tr>");
                    }
                }
                optionhtml += "</table>";

                sortMenu.html(optionhtml);
                sortMenu.find("td").click(function (e) {
                    sortMenu.find('*').removeClass("headerSortDown").removeClass('headerSortUp');
                    headers.removeClass("headerSortDown").removeClass('headerSortUp');
                    var sortField = $(this).attr('sortfield');
                    currentTH.data('sortfield', sortField);
                    var type = $(this).attr('fieldtype');
                    currentTH.data('sortField', sortField);

                    if (!currentTH.data('sortdirection')) {
                        currentTH.data('sortdirection', 'asc');
                        currentTH.addClass("headerSortUp");
                        $(this).addClass("headerSortUp");
                    }
                    else if (currentTH.data('sortdirection') === "asc") {
                        currentTH.data('sortdirection', 'desc');
                        currentTH.addClass("headerSortDown");
                        $(this).addClass("headerSortDown");
                    }
                    else if (currentTH.data('sortdirection') === "desc") {
                        currentTH.data('sortdirection', 'asc');
                        currentTH.addClass("headerSortUp");
                        $(this).addClass("headerSortUp");
                    }
                    done({ field: sortField, type: type, direction: currentTH.data('sortdirection') });

                });

            }

        }
    }

    $.fn.setAsBookDropDown = function (changed) {
        //                   ,KellyBlueBook_trade as [KBB]
        //	                ,KellyBlueBook_option_adj 
        //	                ,KellyBlueBook_mileage_adj
        //	                , NAAA_avg as NAAA

        var opts = this.find('option'), optsl = opts.length, field, mileageField, optionField;
        while (optsl--) {
            switch ($(opts[optsl]).val()) {
                case '800':
                    field = 'NADATradeIn';
                    mileageField = 'NADA_mileage_adj';
                    optionField = 'NADA_option_adj';
                    break;
                case '801':
                    field = 'NADACleanTradeIn';
                    mileageField = 'NADA_mileage_adj';
                    optionField = 'NADA_option_adj';
                    break;
                case '2961':
                    field = 'NADA_AvgTradeIn';
                    mileageField = 'NADA_mileage_adj';
                    optionField = 'NADA_option_adj';
                    break;
                case '2962':
                    field = 'NADARoughTradeIn';
                    mileageField = 'NADA_mileage_adj';
                    optionField = 'NADA_option_adj';
                    break;
                case '799':
                    field = 'NADACleanRetail';
                    mileageField = 'NADA_mileage_adj';
                    optionField = 'NADA_option_adj';
                    break;
                case '798':
                    field = 'NADARetail';
                    mileageField = 'NADA_mileage_adj';
                    optionField = 'NADA_option_adj';
                    break;
                case '2963':
                    field = 'NADALoan';
                    mileageField = 'NADA_mileage_adj';
                    optionField = 'NADA_option_adj';
                    break;
                case '785':
                    field = 'BlackBookRetailXClean';
                    optionField = 'BlackBook_option_adj';
                    mileageField = 'BlackBook_xclean_mileage_adj';
                    break;
                case '786':
                    field = 'BlackBookRetailClean';
                    optionField = 'BlackBook_option_adj';
                    mileageField = 'BlackBook_clean_mileage_adj';
                    break;
                case '787':
                    field = 'BlackBookRetailAverage';
                    optionField = 'BlackBook_option_adj';
                    mileageField = 'BlackBook_average_mileage_adj';
                    break;
                case '788':
                    field = 'BlackBookRetailRough';
                    optionField = 'BlackBook_option_adj';
                    mileageField = 'BlackBook_rough_mileage_adj';
                    break;
                case '2956':
                    field = 'BlackBookWholesaleXClean';
                    optionField = 'BlackBook_option_adj';
                    mileageField = 'BlackBook_xclean_mileage_adj';
                    break;
                case '2957':
                    field = 'BlackBookWholesaleClean';
                    optionField = 'BlackBook_option_adj';
                    mileageField = 'BlackBook_clean_mileage_adj';
                    break;
                case '2958':
                    field = 'BlackBookWholesaleAverage';
                    optionField = 'BlackBook_option_adj';
                    mileageField = 'BlackBook_average_mileage_adj';
                    break;
                case '2959':
                    field = 'BlackBookWholesaleRough';
                    optionField = 'BlackBook_option_adj';
                    mileageField = 'BlackBook_rough_mileage_adj';
                    break;

            }

            $(opts[optsl]).data('field', field);
            $(opts[optsl]).data('optionField', optionField);
            $(opts[optsl]).data('mileageField', mileageField);
        }
        this.change(function (evnts) {
            if (changed)
                changed(getReturnValue(this));
        });
        if (changed) {
            changed(getReturnValue());
        }

        function getReturnValue(slct) {
            var sOpt = $(slct).find("option:selected");
            if (sOpt.length === 0) {
                sOpt = $(opts[0]);
            }

            return { field: sOpt.data('field'), optionField: sOpt.data('optionField'), mileageField: sOpt.data('mileageField') };
        }

    };

    $.tabularData = function (data, recordsPerPage) {
        var oData = data.slice(0), currentPage = 0, maxPage, l, sortField, sortType, sortDir, cData;
        maxPage = parseInt(data.length / recordsPerPage);
        units = data.length;
        cData = data.slice(currentPage * recordsPerPage, currentPage * recordsPerPage + recordsPerPage);
        function filterData(cmprsn, done) {
            reset();

            l = data.length;
            while (l--) {
                if (!cmprsn(data[l])) {
                    data.splice(l, 1);
                }
            }
            if (sortField && sortType && sortDir) {
                $.sortArray(data, sortField, sortType, sortDir);
            }

            maxPage = parseInt(data.length / recordsPerPage);
            page();
            if (done) {
                done(cData);
            }
        }
        return {
            units: function () { return units; },
            currentPage: function () { return currentPage; },
            maxPage: function () { return maxPage },
            currentData: function () { return cData },
            filteredData: function () { return data },
            forceFirst: function () { currentPage = 0; },
            next: function (done) {
                if (currentPage === maxPage)
                    return;
                currentPage++;
                page();
                if (done) {
                    done(cData);
                }

            },
            previous: function (done) {
                if (currentPage === 0)
                    return;
                currentPage--;
                page();
                if (done) {
                    done(cData);
                }
            },
            last: function (done) {
                if (currentPage === maxPage)
                    return;
                currentPage = maxPage
                page();
                if (done) {
                    done(cData);
                }
            },
            first: function (done) {
                if (currentPage === 0)
                    return;
                currentPage = 0
                page();
                if (done) {
                    done(cData);
                }
            },
            pageChange: function (gotoPage, done) {
                currentPage = gotoPage
                page();
                if (done) {
                    done(cData);
                }

            },

            filter: function (prop, cmprsn, done) {
                //should have not included property,call 'overloaded' function if done is null
                if (!done) {
                    return filterData(prop, cmprsn);
                }

                reset();

                l = data.length;
                while (l--) {
                    if (cmprsn(data[l][prop])) {
                        data.splice(l, 1);
                    }
                }
                if (sortField && sortType && sortDir) {
                    $.sortArray(data, sortField, sortType, sortDir);
                }

                maxPage = parseInt(data.length / recordsPerPage);
                page();
                if (done) {
                    done(cData);
                }

            },
            sort: function (prop, type, dir, done) {
                sortField = prop || sortField;
                sortType = type || sortType;
                sortDir = dir || sortDir;
                $.sortArray(data, prop, type, dir);
                page();
                if (done) {
                    done(cData);
                }
            },
            reset: reset
        };
        function page() {
            //set unit count
            units = data !== null ? data.length : 0;
            cData = data.slice(currentPage * recordsPerPage, currentPage * recordsPerPage + recordsPerPage);
        }
        function reset(done) {
            data = oData.slice(0);
            currentPage = 0
            units = data !== null ? data.length : 0;
            maxPage = parseInt(data.length / recordsPerPage);
            if (sortField && sortType && sortDir) {
                $.sortArray(data, sortField, sortType, sortDir);
            }
            cData = data.slice(currentPage * recordsPerPage, currentPage * recordsPerPage + recordsPerPage);


            if (done) {
                done(cData);
            }

        }
    }

    $.beforeunload = function (doCheck, to, msg, stayed) {
        var cancelexit = false;

        //IE - settimeout will not fire the function while the doc is loading - GOOD
        //Chrome - settimeout will fire if the page doesn't load in time - BAD
        //Chrome - onunload doesn't fire untill the document is done requesting the new resource, not before it makes the request - BAD
        //do something with a frame??
        //this can reliably work on pop ups since the only thing that can happen is a close which will occur immediately
        //but if a navigation to another page occurs or a reload, we have no idea how long that will take
        window.onbeforeunload = function (e) {
            if (doCheck()) { //condition to save
                setTimeout(function (e) {
                    if (cancelexit)
                        if (stayed) {
                            stayed();
                        }
                    cancelexit = false;
                }, to);
                cancelexit = true;
                return msg;
            }

        }
        window.onunload = function (e) {

        }
    }


})(jQuery)


$.OpenFDVDPPage = function (stocknumber, vin, make, makeId, isNew) {
    isNew = isNew || false;
    var url = "../FDVDP/FordVDPRedirect.aspx?stock=" + stocknumber + "&vin=" + vin + "&makeId=" + makeId + "&make=" + make + "&isNew=" + isNew;
    $.popup(url, "", 900, 700, true, true, true);
    return false;
}

function addCommas(nStr) {
    nStr += '';
    x = nStr.split('.');
    x1 = x[0];
    x2 = x.length > 1 ? '.' + x[1] : '';
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) {
        x1 = x1.replace(rgx, '$1' + ',' + '$2');
    }
    return x1 + x2;
}



if (typeof String.prototype.supplant !== 'function') {
    String.prototype.supplant = function (o) {
        return this.replace(/{([^{}]*)}/g, function (a, b) {
            var r = o[b];
            return typeof r === 'string' ? r : a;
        });
    };
}

$.fn.focusNextInputField = function (selectAllText) {
    return this.each(function () {
        var fields = $(this).parents('form:eq(0),body').find('button,input,textarea,select');
        var index = fields.index(this);

        if (index > -1 && (index + 1) < fields.length) {
            fields.eq(index + 1).focus();

            if (selectAllText)
                try { fields.eq(index + 1).select(); } catch (e) { }
        }

        return false;
    });
};

$.findObject = function (data, expression) {
    var criteria = (typeof (expression) == "object") ? expression : eval("(" + expression + ")");
    var result = null;
    var isMatch = false;

    for (var i = 0; i < data.length; i++) {
        var temp = data[i];

        if (temp.constructor.toString().indexOf("Array") >= 0) {
            isMatch = false;

            for (var j = 0; j < temp.length; j++) {
                var temp2 = temp[j];
                temp2 = $.findObject(temp2, expression);
                isMatch = temp2 != null;

                if (isMatch) {
                    result = temp2;
                    break;
                }
            }

            if (isMatch)
                break;
        }
        else {
            isMatch = true;

            for (prop in criteria) {
                if (criteria[prop] != temp[prop])
                    isMatch = false;
            }

            if (isMatch) {
                result = temp;
                break;
            }
        }
    }

    return result;
};

$.encodeObjectAsQueryString = function (obj) {
    if (obj.constructor.toString().indexOf("Array") >= 0)
        return $.encodeArrayAsQueryString(obj);

    var params = new Array();

    for (prop in obj) {
        params.push(prop + "=" + encodeURIComponent(obj[prop]));
    }

    return params.join("&");
};

$.encodeArrayAsQueryString = function (arr) {
    var result = "";
    var separator = "";

    for (var i = 0; i < arr.length; i++) {
        result += separator + $.encodeObjectAsQueryString(arr[i]);
        separator = "&";
    }

    return result;
};

$.popup = function (url, target, width, height, allowScroll, allowResize, setFocus, callBacks) {
    if (!$.isHostedInCore()) {
        if (allowScroll == undefined) allowScroll = true;
        if (allowResize == undefined) allowResize = true;

        var leftPos = (screen.width) ? ((screen.width - width) / 2) : 100;
        var topPos = (screen.height) ? ((screen.height - height) / 2) : 100;
        var settings = "width=" + width + ",height=" + height + ",top=" + topPos + ",left=" + leftPos + ",scrollbars=" + (allowScroll ? "yes" : "no") + ",location=no,directories=no,status=no,menubar=no,toolbar=no,resizable=" + (allowResize ? "yes" : "no");

        var win = window.open(url, target, settings, false);

        if (win && callBacks)
            try { win.callBacks = callBacks; } catch (e) { }
        //some browsers not liking this if windows are different domains
        if (win) {
            try { win.opener = window; } catch (e) { }
        }

        if (setFocus)
            try { win.focus(); } catch (e) { }
        return win;
    }
    else {
        window.external.HandleNavigation(url);
    }
};

$.isHostedInCore = function () {
    try { return ((window.external != null) && (window.external.CoreClient != null)); } catch (ex) { return false; }
};

$.fn.titleCase = function () {
    return this.blur(function () {
        var val = this.value ? this.value.toString() : "";
        if (val.length > 1)
            this.value = val.substr(0, 1).toUpperCase() + val.substr(1, val.length - 1);
        else if (val.length > 0)
            this.value = val.toUpperCase();
    }).keypress(function (evt) {
        var t = $(this);
        val = t.val() ? t.val().toString() : "";
        if (typeof t.caret === "function") // if jquery.maskedinput.js is included
        {
            if (t.caret().end == 0 && evt.which >= 97 && evt.which <= 122)
                evt.originalEvent.keyCode -= 32;
        }
        else if (val.length > 1)
            t.val(val.substr(0, 1).toUpperCase() + val.substr(1, val.length - 1));
        else if (val.length > 0)
            t.val(val.toUpperCase());
    });
};

$.fn.excludeChars = function (re) {
    re.global = true;
    return this.keypress(function (evt) {
        if (evt.which < 32) return true;
        if (re.test(String.fromCharCode(evt.which))) evt.preventDefault();
    }).blur(function (evt) {
        this.value = this.value.replace(re, "");
    });
};

$.fn.restrictToIntegers = function () {
    return this.keypress(function (evt) {
        if (evt.which < 32) return true;
        if (/[0-9]|-/.test(String.fromCharCode(evt.which)))
            return true;
        else
            evt.preventDefault();
    }).blur(function (evt) {
        this.value = this.value.match(/^-?[0-9]+$/g);
    });
};

$.fn.restrictToMoney = function (done) {
    var oVal = $(this).val();
    return this.change(function (evt) {
        var value = $(this).val(), intRegex = /^\-?\(?\$?\s*\-?\s*\(?(((\d{1,3}((\,\d{3})*|\d*))?(\.\d{1,4})?)|((\d{1,3}((\,\d{3})*|\d*))(\.\d{0,4})?))\)?$/;
        if (!intRegex.test(value)) {
            $(this).val(oVal);
            evt.preventDefault();
        }
        else {
            oVal = '$' + $.formatNumber(value.replace(/[^0-9\.]+/g, ''));
            $(this).val(oVal);
            if (done) {
                done(value);
            }
        }

    });
    return this;
};

$.fn.restrictToDecimal = function () {
    return this.keypress(function (evt) {
        if (/[0-9]|-|\./.test(String.fromCharCode(evt.which)))
            return true;
        else
            evt.preventDefault();
    }).blur(function (evt) {
        var matches = this.value.match(/^-?[0-9]\d*(\.\d+)?$/);
        this.value = matches && matches.length > 0 ? matches[0] : '';
    });
};

$.fn.enforceMinimumNumericValue = function (minimumValue, defaultValue, errorMessage) {
    return this.blur(function () {
        this.value = this.value.match(/^-?[0-9]+$/g);
        if (this.value == '') { this.value = 0; }
        if (parseInt(this.value) < parseInt(minimumValue)) {
            this.value = defaultValue;
            if (errorMessage.length > 0)
                alert(errorMessage);
        }
    });
};

$.fn.enforceMaximumNumericValue = function (maximumValue, defaultValue, errorMessage) {
    return this.blur(function () {
        this.value = this.value.match(/^-?[0-9]+$/g);
        if (this.value == '') { this.value = 0; }
        if (parseInt(this.value) > parseInt(maximumValue)) {
            this.value = defaultValue;
            if (errorMessage.length > 0)
                alert(errorMessage);
        }
    });
};

$.fn.buildDropdown = function (items, textField, valueField, noSelectionText, selectedValue, selectedText) {
    if (!items)
        return;
    items = eval(items);
    var options = "", item = null;
    selectedValue = "" + selectedValue;
    if (noSelectionText != null)
        options = "<option value=\"\">" + noSelectionText + "</option>";

    for (var i = 0; i < items.length; i++) {
        item = items[i];

        if (textField && valueField) {
            if ((selectedValue != null) && (String(item[valueField]).toLowerCase() == selectedValue.toLowerCase()))
                options += "<option value=\"" + item[valueField] + "\" selected>" + item[textField] + "</option>";
            else if ((selectedText != null) && (String(item[textField]).toLowerCase() == selectedText.toLowerCase()))
                options += "<option value=\"" + item[valueField] + "\" selected>" + item[textField] + "</option>";
            else
                options += "<option value=\"" + item[valueField] + "\">" + item[textField] + "</option>";
        }
        else {
            options += "<option value=\"" + item + "\">" + item + "</option>";
        }
    }
    return this.html(options);
};

$.validatorsAreValid = function (validationGroup) { // check asp.net validator controls
    if (validationGroup)
        return ((typeof (Page_IsValid) == "undefined") || Page_ClientValidate(validationGroup));
    else
        return ((typeof (Page_IsValid) == "undefined") || Page_ClientValidate());
};

$.fn.appendDropdown = function (text, value, isSelected) {
    return this.each(function () {
        var opt = document.createElement("OPTION");
        opt.value = value;
        opt.text = text;
        opt.selected = isSelected;
        this.options.add(opt);
    });
};
$.fn.removeItemFromDropdown = function (value) {
    return this.each(function () {
        $(this).find("option[value=" + value + "]").remove();
    });
};
$.fn.upperCase = function () {
    return this.blur(function () { $(this).val($(this).val().toUpperCase()); })
        .keypress(function (evt) {
            var t = $(this);
            if (typeof t.caret === "function") // if jquery.maskedinput.js is included
            {
                if (evt.which >= 97 && evt.which <= 122)
                    evt.originalEvent.keyCode -= 32;
            }
            else
                $(this).val($(this).val().toUpperCase());
        });
};
$.fn.isEnabled = function (val) {
    if (val == undefined || typeof val == "undefined" || val == null)
        return !(this.attr("disabled") == "disabled" || this.attr("readonly") == true);
    else if (val)
        return this.removeAttr("disabled");
    else
        return this.attr("disabled", "disabled");
};
$.fn.isChecked = function (val) {
    if (val == undefined || typeof val == "undefined" || val == null)
        return $(this).attr("checked") === "checked";
    else if (val)
        return this.attr("checked", true);
    else
        return this.attr("checked", false);
};
$.fn.isVisible = function (val) {
    if (val == undefined || typeof val == "undefined" || val == null)
        return this.is(":visible");
    else if (val)
        return this.show();
    else
        return this.hide();
};
$.fn.toggleVisibility = function () {
    return this.isVisible(!this.isVisible());
}
$.insertCommas = function (nStr) {
    nStr += '';
    var x = nStr.split('.');
    var x1 = x[0];
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) { x1 = x1.replace(rgx, '$1' + ',' + '$2'); }
    return x1 + (x.length > 1 ? '.' + x[1] : '');
};
$.fn.num = function (val, maxPrec) {
    if (!maxPrec) maxPrec = 0;
    return this.each(function () {
        var n = new Number(val);
        if (n != NaN)
            this.value = $.insertCommas(n.toFixed(maxPrec).toString());
        else
            this.value = val;
    });
};
$.fn.numWOComma = function (val, maxPrec) {
    if (!maxPrec) maxPrec = 0;
    return this.each(function () {
        var n = new Number(val);
        if (n != NaN)
            this.value = n.toFixed(maxPrec).toString();
        else
            this.value = val;
    });
};
$.formatNumber = function (val, maxPrec) {
    if (!maxPrec) maxPrec = 0;
    var n = new Number(val);
    return (n != NaN) ? $.insertCommas(n.toFixed(maxPrec).toString()) : val;
};
$.selectTOManager = function (chkbox) {
    if (chkbox.checked == true)
        $.showModals();
    else
        $.hideModals();
};

$.inShowRoomCheckStatus = function (chkbox) {
    var inShowRoomChecked = document.getElementById('OpportunityPanel_inShowRoomSession');
    inShowRoomChecked.value = chkbox.checked == true ? "true" : "false";

};

$.showModals = function () {
    $('#OuterModalSalesStepManagerPanel').show();
    $('#InnerModalSalesStepManagerPanel').show();
    $('#ModalSalesStepManagerPanel').show();
};
$.hideModals = function () {
    $('#OuterModalSalesStepManagerPanel').hide();
    $('#InnerModalSalesStepManagerPanel').hide();
    $('#ModalSalesStepManagerPanel').hide();
};
$.compare = function (o1, o2) {
    if (o1 == null && o2 == null)
        return true;
    if (o1 == null && o2 != null)
        return false;
    if (o1 != null && o2 == null)
        return false;

    if (typeof (o1) == typeof (o2)) {
        if (typeof (o1) == 'object') {
            if (o1 === o2) {
                return true;
            }
            else {
                for (p in o1) {
                    if (o1.hasOwnProperty(p) && (typeof (o1[p]) != "function") && (p in o2)) {
                        var T = typeof (o1[p]);

                        if (T == typeof (o2[p])) {
                            switch (T) {
                                case 'boolean':
                                    if (o1[p] != o2[p]) {
                                        d("boolean prop:" + p + " " + o1[p] + " != " + o2[p]);
                                        return false;
                                    }
                                    break;
                                case 'number':
                                    if (o1[p] != o2[p]) {
                                        d("number prop:" + p + " " + o1[p] + " != " + o2[p]);
                                        return false;
                                    }
                                    break;
                                case 'string':
                                    if (o1[p] != o2[p]) {
                                        d("string prop:" + p + " " + o1[p] + " != " + o2[p]);
                                        return false;
                                    }
                                    break;
                                case 'object':
                                    if (!$.compare(o1[p], o2[p])) {
                                        d("object prop:" + p + " " + o1[p] + " != " + o2[p]);
                                        return false;
                                    }
                                    break;
                                default:
                                    // alert( 'p: ' + p + ' typeof: ' + T );
                                    break;
                            }
                        }
                        else {
                            d("Types " + T + " and " + typeof (o2[p]) + " for prop:" + p + " do not match.");
                            return false;
                        }
                    }
                    else {
                        return false;
                    }
                }
            }
        }
    }
    return true;
};
function d(msg) {
    //debugger;
}
$.isEmptyObject = function (o) {
    for (var n in o) {
        return false;
    }
    return true;
}
$.getNumber = function (val) {
    if (val == null)
        return 0;
    val = val.toString().replace(/[^\d\.%\$\-]/g, "");
    while (val.indexOf(".") != val.lastIndexOf(".")) {
        val = val.substr(0, val.lastIndexOf(".")) + "" + val.substr(val.lastIndexOf(".") + 1);
    }
    return (val == "" || val == ".") ? 0 : new Number(val).valueOf();
}
$.getWholeNumber = function (val) {
    val = val.toString().replace(/[^\d\.%\$\-]/g, "");
    while (val.indexOf(".") != val.lastIndexOf(".")) {
        val = val.substr(0, val.lastIndexOf(".")) + "" + val.substr(val.lastIndexOf(".") + 1);
    }
    if (val.indexOf(".") != -1) val = val.substr(0, val.indexOf("."));
    return (val == "" || val == ".") ? 0 : new Number(val).valueOf();
}
var __modalWinHandle = null, __hasFocus = true;
$.behaveLikeModalPopup = function () {
    $(window).focus(function () { __hasFocus = true; }).blur(function () { __hasFocus = false; });
    $("input,a,select,img,button").focus(function () { __hasFocus = true; }).blur(function () { __hasFocus = false; });
    __modalWinHandle = window.setInterval(__ensureModalCheck, 100);
}
function __ensureModalCheck() {
    try {
        if (window.closed) {
            if (__modalWinHandle != null)
                window.clearInterval(__modalWinHandle);
            __modalWinHandle = null;
        }
        else if (!__hasFocus) {
            window.focus();
        }
    }
    catch (err) { }
}
$.postToPopup = function (url, target, objPostData, width, height, allowScroll, allowResize, setFocus) {
    if (target == "_blank" || target == "" || target == null)
        target = Math.random().toString().replace(/[\.,]/g, "");
    else
        target += Math.random().toString().replace(/[\.,]/g, "");

    $("body").append("<form target=\"" + target + "\" method=\"post\" action=\"" + url + "\" id=\"__" + target + "\"></form>");
    var frm = $("#__" + target);
    frm.hide();

    for (prop in objPostData) {
        // adjusted createElement from input to textarea.
        // reason - input fields have a default value of 524288 even though a lot of documentation states 'unlimited'
        var input = document.createElement("textarea");

        input.value = objPostData[prop];
        input.name = prop;
        frm.append(input);

        //$(document.createElement("input")).attr("name", prop).val(objPostData[prop]).appendTo(frm);
    }

    var win = $.popup("../desking/loading.html", target, width, height, allowScroll, allowResize, setFocus);
    frm.get(0).submit();
    return win;
}
$.stringify = function (object) {
    var o = (typeof object == 'object') && object != null ? object : null;
    var c = "";
    //debugger;
    if (o != null) {
        var s = '';
        var constr;
        var a = function (o) { return (typeof o === 'object' && o ? ((typeof o.length === 'number' && !(o.propertyIsEnumerable('length')) && typeof o.splice === 'function') ? true : false) : false); }; //is array?
        for (var v in o) {
            if (!o.hasOwnProperty(v))
                continue;
            constr = (o[v] != null && o[v].constructor != null) ? o[v].constructor.toString() : "";
            if (constr.indexOf("Array") > -1) {
                s += v + ":[";
                for (var i = 0; i < o[v].length; i++) {
                    s += c + "{" + $.stringify(o[v][i]) + "}";
                    c = ","
                }
                s += "],";
            }
            else if (constr.indexOf("Date(") > -1) {
                s += v + ":new Date(" + o[v].valueOf() + "),";
            }
            else if (constr.indexOf("Number(") > -1) {
                s += v + ":" + o[v] + ",";
            }
            else
                s += typeof o[v] === 'object' ? (o[v] ? (
                    (typeof o[v].length === 'number' && !(o[v].propertyIsEnumerable('length')) && typeof o[v].splice === 'function') ?
                        v + ':' + '[' + $.stringify(o[v]) + '],' :
                        v + ':' + '{' + $.stringify(o[v]) + '},'
                ) : v + ':' + o[v] + ',')
                    : v + ':' + (typeof o[v] == 'string' ? '\'' + o[v].replace(/\'/g, '\\\'').replace(/\"/g, "\\\"") + '\'' : o[v]) + ',';
        };
        o = s.length > 0 ? s.substring(0, s.length - 1) : s;
    } else {
        o = object;
    };
    return o;
};
if (!$.clone) {
    $.clone = function (src) {
        return eval("({" + $.stringify(src) + "})");
    };
}
$.getCSS = function (url, media) {
    jQuery(document.createElement('link')).attr({
        href: url,
        media: media || 'screen',
        type: 'text/css',
        rel: 'stylesheet'
    }).appendTo('head');
};
$.makeDateUrlSafe = function (javascriptDateObj) {
    try {
        var res = (javascriptDateObj.getMonth() + 1)
            + "/" + javascriptDateObj.getDate()
            + "/" + javascriptDateObj.getFullYear()
            + " " + javascriptDateObj.getHours() + ":"
            + $.right("0" + javascriptDateObj.getMinutes(), 2) + ":"
            + $.right("0" + javascriptDateObj.getSeconds(), 2) + "."
            + $.right("000" + javascriptDateObj.getMilliseconds(), 3);
        return escape(res);
    } catch (ex) { return javascriptDateObj; }
};
$.left = function (s, len) {
    return (s.length <= len) ? s : s.substring(0, len);
};
$.right = function (s, len) {
    return (s.length <= len) ? s : s.substr(s.length - len, len);
};
$.findProp = function (obj, val) {
    for (prop in obj) {
        if (obj[prop] == val)
            return prop.toString();
    }
    return "";
};
$.binarySearch = function (a, p, v) {
    var s = 0, e = a.length - 1, c = Math.floor((e + s) / 2), m, lc = -1;

    while ((m = a[c]) != v && s < e) {
        if (v < m[p])
            e = c - 1;
        else if (v > m[p])
            s = c + 1;

        c = Math.floor((e + s) / 2);
        if (c == lc)
            s = e;
        else
            lc = c;
    }

    if (m)
        return (m[p] != v) ? -1 : c;
    else
        return -1;
};
$.fn.consumeRemainingSpace = function (minHeight) {
    var _heightOfOtherElements = 0, _scrollSize = 0;
    var ctl = $(this);
    window.status = "";
    function fitElement() {
        try {
            var availableHeight = 0;
            if (window.innerHeight)
                availableHeight = window.innerHeight;
            else if (document.body && document.body.clientHeight)
                availableHeight = document.body.clientHeight;
            else if (document.documentElement && document.documentElement.clientHeight)
                availableHeight = document.documentElement.clientHeight;
            else if (document.body && document.body.offsetHeight)
                availableHeight = document.body.offsetHeight;
            else if (document.documentElement && document.documentElement.offsetHeight)
                availableHeight = document.documentElement.offsetHeight;
            else
                availableHeight = 0;

            if (availableHeight > 0 && availableHeight < 1500) {
                if (_heightOfOtherElements == 0) {
                    ctl.height(availableHeight + "px");

                    if (document.body && document.body.scrollHeight)
                        _scrollSize = document.body.scrollHeight;
                    else
                        _scrollSize = Math.max($(document).height(), $(document.body).height());

                    _heightOfOtherElements = _scrollSize - availableHeight + 4;
                }

                ctl.height(Math.max(minHeight, availableHeight - _heightOfOtherElements) + "px");
            }
        } catch (ex) { window.status = ex.message; }
    }
    $(window).resize(function () { window.setTimeout(fitElement, 10); });
    window.setTimeout(fitElement, 100);
};

$.popupOppty = function (customerId, opptyId, extraQueryString) {
    if (!extraQueryString)
        extraQueryString = "";
    else if (extraQueryString && extraQueryString.substr(0, 1) != "&")
        extraQueryString = "&" + extraQueryString;

    var url = getMainPath();
    opptyId = ((opptyId > 0) ? "&lDID=" + opptyId : "");
    return $.popup(url + "NewProspects/OpptyDetails.aspx?lPID=" + customerId + opptyId + extraQueryString, "oppty_" + customerId, 1250, 1000, true, true, true);
};
function getMainPath() {
    var url = window.location.href;
    if (url.indexOf("?") > 0)
        url = url.split("?")[0];
    url = url.substr(0, url.lastIndexOf("/") + 1);
    var paths = url.toLowerCase().split("/");
    var i;
    for (i = 0; i < paths.length; i++)
        if (paths[i] == "elead_track")
            break;

    url = "";
    i += 2;
    for (; i < paths.length; i++)
        url += "../";
    return url;
}
$.fn.cleanedVal = function (regEx, replaceWith) {
    var ctl = $(this);
    ctl.val(ctl.val().replace(regEx, replaceWith));
    return ctl.val();
};
$.fn.selectOptionByText = function (data) {
    $(this).find("option").each(function () {
        if ($(this).text() === data)
            $(this).attr("selected", "selected");
    });
};
$.fn.blink = function (numBlinks) {
    var me = $(this);
    numBlinks = numBlinks ? numBlinks * 2 : 10;
    var blinkCount = 0;

    function blink_toggle() {
        blinkCount++;
        if (blinkCount >= numBlinks)
            me.show();
        else {
            me.toggleVisibility();
            window.setTimeout(blink_toggle, 500);
        }
    }

    window.setTimeout(blink_toggle, 500);
    return this;
};
$.fn.flashbg = function (color, count) {
    var me = $(this);
    var orig = me.css("background-color");
    var state = 0;
    count = count ? (count * 2) : 20;

    function toggle() {
        if (state > count - 1) {
            me.css("background-color", orig);
            return;
        }

        me.css("background-color", state++ % 2 === 0 ? color : orig);
        window.setTimeout(toggle, 500);
    }

    window.setTimeout(toggle, 500);
    return this;
}
$.notifyWhenClosed = function (win, callback) {
    function checkWin() {
        if (win != null) {
            if (win.closed) {
                window.clearInterval(_interval);
                callback();
            }
        }
        else {
            if (_interval != null) {
                window.clearInterval(_interval);
                callback();
            }
        }
    }

    var _interval = window.setInterval(checkWin, 100);
};
$.fn.setPhoneNumber = function (v, prop, valueSet, getCollection, showError) {
    this.change(function (e) {
        changePhone.call(this, prop);
    });
    function validatePhoneNumber(elementValue) {
        var phoneNumberPattern = /^\(?(\d{3})\)?[- ]?(\d{3})[- ]?(\d{4})$/;
        return phoneNumberPattern.test(elementValue);
    }
    this.val(function (i, c) {
        var pn = "";
        var i;
        var phoneNumbers = getCollection();
        if ($.trim(v) !== "") {
            pn = v;
        }
        else {
            if (phoneNumbers !== null && phoneNumbers.length > 0) {
                i = phoneNumbers.length;
                while (i--) {
                    if (phoneNumbers[i].Type === prop && phoneNumbers[i].AreaCode !== "") {
                        pn = "(" + phoneNumbers[i].AreaCode + ")" + phoneNumbers[i].Number;
                    }
                }

            }

        }

        return pn;
    });
    function changePhone(appProperty) {
        var vPhone = this.value;
        var found = false;
        var i;
        var phoneNumbers = getCollection();
        if ($.trim(vPhone) !== "") {
            if (validatePhoneNumber(vPhone)) {
                //insert
                hPhone = vPhone.replace(/\D/g, '');
                if (valueSet)
                    valueSet(vPhone);

                if (phoneNumbers !== null && phoneNumbers.length > 0) {
                    i = phoneNumbers.length;
                    while (i--) {
                        if (phoneNumbers[i].Type === appProperty) {
                            found = true;
                            phoneNumbers[i].AreaCode = hPhone.substring(0, 3);
                            phoneNumbers[i].Number = hPhone.substring(3, 6) + "-" + hPhone.substring(6, 10);
                        }

                    }

                }
                if (!found) {
                    var newPN = {};
                    newPN.Type = appProperty;
                    phoneNumbers.push(newPN);
                    newPN.AreaCode = hPhone.substring(0, 3);
                    newPN.Number = hPhone.substring(3, 6) + "-" + hPhone.substring(6, 10);
                }
            }
            else if (showError) {
                showError(this, v);
            }
        }
    }
}
$.fn.setEmail = function (v, valueSet, getCollection, showError) {
    function validateEmail(elementValue) {
        var emailPattern = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*\.(\w{2}|(com|net|org|edu|int|mil|gov|arpa|biz|aero|name|coop|info|pro|museum|corp))$/;
        return emailPattern.test(elementValue.toString().toLowerCase());
    }
    this.val(function (i, c) {
        if (v && $.trim(v) !== "")
            return v;

        if (getCollection) {
            var emails = getCollection();
            if (emails && emails.length && emails.length > 0) {
                if (emails.length !== 1) {
                    $.each(emails, function (e) {
                        if (emails[e].IsPrimary)
                            return emails[e].Value;
                    }
                    );
                }
                else {
                    return emails[0].Value;
                }
            }
        }
        return "";
    });

    this.change(function (e) {
        // fix for multiple event binding
        if (!this.value)
            return;

        var found = false;
        var email = this.value;

        if (validateEmail(email)) {
            if (valueSet)
                valueSet(email);
            var emails = getCollection();
            if (emails && emails.length > 0) {
                $.each(emails, function (index, objVal) {
                    if (emails[index].IsPrimary) {
                        found = true;
                        emails[index].Value = email;
                    }
                }
                );
            }
            if (!found) {
                var newPN = {};
                emails.push(newPN);
                newPN.Value = email;
                newPN.IsPrimary = true;
            }

        }
        else if (showError) {
            showError(this, v);
        }
    });
}
$.fn.setZip = function (v, prop, valueSet, getCollection, showError) {
    this.change(function (e) {
        changeZip.call(this, prop);
    });
    function validateZip(elementValue) {
        var zipPattern = /^\d{5}(?:[-\s]\d{4})?$/;
        var canadianZipPattern = /^[ABCEGHJKLMNPRSTVXY]{1}\d{1}[A-Z]{1} *\d{1}[A-Z]{1}\d{1}$/
        return zipPattern.test(elementValue) || canadianZipPattern.test(elementValue);
    }
    this.val(function (i, c) {
        if (v && $.trim(v) !== "")
            return v;

        return "";
    });
    function changeZip(appProperty) {
        if (!this.value)
            return;

        var found = false;
        var zip = this.value;

        if (validateZip(zip)) {
            if (valueSet)
                valueSet(zip);
            var zips = getCollection();
            if (zips && zips.length > 0) {
                $.each(zips, function (index, objVal) {
                    if (zips[index].IsPrimary) {
                        found = true;
                        zips[index].Value = zip;
                    }
                }
                );
            }
            if (!found) {
                var newPN = {};
                zips.push(newPN);
                newPN.Value = zip;
                newPN.IsPrimary = true;
            }

        }
        else if (showError) {
            showError(this, v);
        }
    }
}
$.fn.setInput = function (obj, prop, obj1, prop1) {
    this.change(function (e) {
        obj[prop] = this.value
        if (obj1 && prop1)
            obj1[prop1] = this.value;
    }).val(obj[prop]);
}
$.fn.setDropDownText = function (obj, prop) {
    this.change(function (e) {
        obj[prop] = $("option:selected", this).text();
    }).val(obj[prop]);
}
$.fn.setAddress = function (v, prop, valueSet, getCollection, showError) {
    this.change(function (e) {
        changeAddress.call(this, prop);
    });

    this.val(function (i, c) {
        var pn = "";
        var i = 0;
        var addresses = getCollection();
        if (v !== null && $.trim(v) !== "") {
            return v;
        }
        else {
            if (addresses !== null && addresses.length > 0) {
                //there is nothing to do but just use the first instance
                return addresses[i][prop];
            }

        }

        return "";
    });
    function changeAddress(appProperty) {
        var found = false;
        var i = 0;
        var addresses = getCollection();
        var aValue = this.value;
        if ($.trim(aValue) !== "") {
            if (valueSet)
                valueSet(this.value);

            if (addresses !== null && addresses.length > 0) {
                found = true;
                addresses[i][prop] = aValue;
            }
            if (!found) {
                var newPN = {};
                addresses.push(newPN);
                addresses[i][prop] = aValue;
            }
        }
        else if (showError) {
            showError(this, v);
        }

    }
}
$(document).ready(function () {
    $('form').each(function () {
        $(this).removeAttr("autocomplete");
        $(this).attr("autocomplete", "off");
    });
});
$(document).ready(function () {
    if ($ && $.makePhoneLinks)
        $.makePhoneLinks();
    if ($ && $.appendBrandStyles)
        $.appendBrandStyles();
    if ($ && $.commentCounter)
        $.commentCounter();

});
$.commentCounter = function () {
    $("textarea[maxlength]").each(
        function () {
            if ($(this).siblings(".charsRemaining").length === 0) {
                $(this).wrap("<div style='position: relative; display: inline;'></div>")
                $(this).after("<span class='charsRemaining' style='position: absolute; right: 20px; bottom: 10px; background: #fff; transparency: 0.4; padding-left: 5px;'></span>");
            }
            $.processComment(this);
        }).keyup(function () { $.processComment(this) });
};
function localizationinitialized(cb) {
    localization.loadingComplete.then(cb())
}

$.processComment = function (element) {
    var maxLength = $(element).attr("maxlength");
    var requiredEntry = $(element).hasClass("required");
    var handleComments = function (commentsRequired) {
        var requiredText = "";
        localizationinitialized(function () {
                if (maxLength > 0) {
                    if (element.value.length == maxLength || element.value.trim().length === 0 && commentsRequired === "true") {
                        if (element.value.trim().length === 0 && commentsRequired === "true") {
                            requiredText = localization.getTranslation("Elead:CommentsRequired")
                            $(".requiredButtons").attr("disabled", "disabled");
                        }
                        $(element).siblings(".charsRemaining").addClass("invalid");
                    }
                    else {
                        $(element).siblings(".charsRemaining").removeClass("invalid");
                        requiredText = "";
                        if (commentsRequired === "true") {
                            $(".requiredButtons").removeAttr("disabled");
                        }
                    }
                    $(element).siblings(".charsRemaining").text(requiredText + (element.value.length) + ' / ' + maxLength);
                }
            });
    }
    if (requiredEntry) {
        var val = "" + $.getCookie("ReqCommentsOnTasks");
        if (!$.getCookie("BackUpEmpID") || val.split("c")[0] != $.getCookie("BackUpEmpID")) {
            $.get(
                getMainPath() + "IncludeFiles/PermissionBridge.aspx?Type=Permission&Value=ReqCommentsOnTasks&UID=" + $.getCookie("BackUpEmpID") + "&CID=" + $.getCookie("BackUpCompanyID"),
                function (data) {
                    if (data != null && data != undefined) {
                        var d = data.toLowerCase();
                        handleComments(d);
                        $.setCookie("ReqCommentsOnTasks", $.getCookie("BackUpEmpID") + "c" + d);
                    }
                }
            );
        }
        else {
            handleComments(val.split("c")[1]);
        }
    }
    else {
        handleComments("false");
    }

};
$.fn.disableOnSubmit = function (settings) {
    var me = $(this);
    settings = $.extend({ message: "Saving...", validate: true, validationGroup: null }, settings);

    me.click(function (evt) {
        if (!settings.validate || $.validatorsAreValid(settings.validationGroup))
            window.setTimeout(function () { me.isEnabled(false).after("<span class=\"textBlack\"> " + settings.message + " <img src=\"../images/ajax-loader.gif\" alt=\"\" border=\"0\" /></span>"); }, 10);
    });

    return this;
};

$.getMyNumber = function (val) {
    var convertedVal = $.getNumber(val);
    if (isNaN(convertedVal))
        return 0;
    return convertedVal;
}

$.keySort = function (arrayToSort, keys) {

    keys = keys || {};

    var obLen = function (obj) {
        var size = 0, key;
        for (key in obj) {
            if (obj.hasOwnProperty(key))
                size++;
        }
        return size;
    };

    var obIx = function (obj, ix) {
        var size = 0, key;
        for (key in obj) {
            if (obj.hasOwnProperty(key)) {
                if (size == ix)
                    return key;
                size++;
            }
        }
        return false;
    };

    var keySort = function (a, b, d) {
        d = d !== null ? d : 1;
        //we are getting strings here...want to check if this is a number or not
        if (typeof (a) === "string" && typeof (b) === "string" && !isNaN(a.replace(",", "")) && !isNaN(b.replace(",", ""))) {
            if (typeof (a) === "string" && typeof (b) === "string") {
                var first = parseFloat(a.replace(",", ""));
                var second = parseFloat(b.replace(",", ""));

                if (first == second)
                    return 0;
                return first > second ? 1 * d : -1 * d;
            }
        }
        else {
            if (a == b)
                return 0;
            return a > b ? 1 * d : -1 * d;
        }
    };

    var KL = obLen(keys);

    if (!KL)
        return arrayToSort.sort(keySort);

    for (var k in keys) {
        // asc unless desc or skip
        keys[k] =
            keys[k] == 'desc' || keys[k] == -1 ? -1
                : (keys[k] == 'skip' || keys[k] === 0 ? 0
                    : 1);
    }

    arrayToSort.sort(function (a, b) {
        var sorted = 0, ix = 0;

        while (sorted === 0 && ix < KL) {
            var k = obIx(keys, ix);
            if (k) {
                var dir = keys[k];
                sorted = keySort(a[k], b[k], dir);
                ix++;
            }
        }
        return sorted;
    });
    return arrayToSort;
}

var g_fields = $(":input");
$.focusNextField = function (ctl) {
    var fields = g_fields;
    var loc = fields.index(ctl.get(0));
    var len = fields.length;

    if (loc == 0) {
        for (var x = 0; x < len; x++) {
            if (this.id === fields.get(x).id) {
                loc = x;
                break;
            }
        }
    }
    var found = false;
    if (loc > -1 && (loc + 1) < len)
        for (var i = loc; i + 1 < len; i++) {
            if (checkVisibleAndEnabled(fields.eq(i + 1))) {
                found = true;
                fields.eq(i + 1).focus();
                return;
            }
        }
    if (!found)
        for (var i = 0; i < len; i++) {
            if (checkVisibleAndEnabled(fields.eq(i))) {
                fields.eq(i).focus();
                return;
            }
        }
    else
        for (var i = 0; i < len; i++) {
            if (checkVisibleAndEnabled(fields.eq(i))) {
                fields.eq(i).focus();
                return;
            }
        }
}

function checkVisibleAndEnabled(ctl) {
    var result = true;

    if ("hidden,checkbox,radio,submit".indexOf(ctl.attr("type")) > -1)
        return false;

    if (ctl.isVisible() && ctl.isEnabled()) {
        ctl.parents().each(function () {
            if (!$(this).isVisible())
                result = false;
        });
    }
    else
        result = false;
    return result;
}

function ResolveWindowPath(windowpath) {
    var windowobject = window;
    var pathnodes = windowpath.split('.');
    for (var i = 0; i < pathnodes.length; i++) {
        if (pathnodes[i] == 'window') { continue; }
        if (windowobject[pathnodes[i]]) {
            windowobject = windowobject[pathnodes[i]];
        }
        else { return null; }
    }
    return windowobject;
}

function HandleWindowActionsByPage(windowpath, method) {
    if (!windowpath && !method) { return; }
    var windowobject = ResolveWindowPath(windowpath);
    if (windowobject) {
        var pagename = windowobject.location.href.match(/[a-z0-9\-_]+\.asp[x]?/i);
        method(windowobject, pagename[0].toLowerCase());
    }
}

function btnResetUserClick() {
    window.sessionStorage.removeItem("SelectedRoleDayPlanner");
    $("#btnResetUser").css("display", "none");
    let lnk = window.location.href.replace(/([?&])role=[^&]*/, '');
    window.location = lnk;
}

function btnResetUserVisibility() {
    if (window.sessionStorage.getItem("SelectedRoleDayPlanner")) {
        $("#btnResetUser").css("display", "inline-block");
    }
}
var matched, browser;

jQuery.uaMatch = function (ua) {
    ua = ua.toLowerCase();

    var match = /(chrome)[ \/]([\w.]+)/.exec(ua) ||
        /(webkit)[ \/]([\w.]+)/.exec(ua) ||
        /(opera)(?:.*version|)[ \/]([\w.]+)/.exec(ua) ||
        /(msie) ([\w.]+)/.exec(ua) ||
        ua.indexOf("compatible") < 0 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec(ua) ||
        [];

    return {
        browser: match[1] || "",
        version: match[2] || "0"
    };
};

matched = jQuery.uaMatch(navigator.userAgent);
browser = {};

if (matched.browser) {
    browser[matched.browser] = true;
    browser.version = matched.version;
}

// Chrome is Webkit, but Webkit is also Safari.
if (browser.chrome) {
    browser.webkit = true;
} else if (browser.webkit) {
    browser.safari = true;
}

jQuery.browser = browser;