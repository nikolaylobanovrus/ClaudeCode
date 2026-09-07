(function(t) {
    function e(e) {
        for (var a, n, o = e[0], c = e[1], l = e[2], u = 0, d = []; u < o.length; u++) n = o[u], Object.prototype.hasOwnProperty.call(i, n) && i[n] && d.push(i[n][0]), i[n] = 0;
        for (a in c) Object.prototype.hasOwnProperty.call(c, a) && (t[a] = c[a]);
        f && f(e);
        while (d.length) d.shift()();
        return r.push.apply(r, l || []), s()
    }

    function s() {
        for (var t, e = 0; e < r.length; e++) {
            for (var s = r[e], a = !0, o = 1; o < s.length; o++) {
                var c = s[o];
                0 !== i[c] && (a = !1)
            }
            a && (r.splice(e--, 1), t = n(n.s = s[0]))
        }
        return t
    }
    var a = {},
        i = {
            app: 0
        },
        r = [];

    function n(e) {
        if (a[e]) return a[e].exports;
        var s = a[e] = {
            i: e,
            l: !1,
            exports: {}
        };
        return t[e].call(s.exports, s, s.exports, n), s.l = !0, s.exports
    }
    n.m = t, n.c = a, n.d = function(t, e, s) {
        n.o(t, e) || Object.defineProperty(t, e, {
            enumerable: !0,
            get: s
        })
    }, n.r = function(t) {
        "undefined" !== typeof Symbol && Symbol.toStringTag && Object.defineProperty(t, Symbol.toStringTag, {
            value: "Module"
        }), Object.defineProperty(t, "__esModule", {
            value: !0
        })
    }, n.t = function(t, e) {
        if (1 & e && (t = n(t)), 8 & e) return t;
        if (4 & e && "object" === typeof t && t && t.__esModule) return t;
        var s = Object.create(null);
        if (n.r(s), Object.defineProperty(s, "default", {
                enumerable: !0,
                value: t
            }), 2 & e && "string" != typeof t)
            for (var a in t) n.d(s, a, function(e) {
                return t[e]
            }.bind(null, a));
        return s
    }, n.n = function(t) {
        var e = t && t.__esModule ? function() {
            return t["default"]
        } : function() {
            return t
        };
        return n.d(e, "a", e), e
    }, n.o = function(t, e) {
        return Object.prototype.hasOwnProperty.call(t, e)
    }, n.p = "/";
    var o = window["webpackJsonp"] = window["webpackJsonp"] || [],
        c = o.push.bind(o);
    o.push = e, o = o.slice();
    for (var l = 0; l < o.length; l++) e(o[l]);
    var f = c;
    r.push([0, "chunk-vendors"]), s()
})({
    0: function(t, e, s) {
        t.exports = s("56d7")
    },
    "004d": function(t, e, s) {},
    "03f9": function(t, e, s) {
        t.exports = s.p + "img/2.dccec589.png"
    },
    "08b3": function(t, e, s) {
        "use strict";
        s("2d67")
    },
    "092f": function(t, e, s) {
        t.exports = s.p + "img/strahov.89bfccba.png"
    },
    "0e97": function(t, e, s) {
        t.exports = s.p + "img/exp1.2012a117.png"
    },
    1284: function(t, e, s) {
        t.exports = s.p + "img/order1.1e5a90d5.png"
    },
    1791: function(t, e, s) {
        t.exports = s.p + "img/telegram_logo.404fe09d.png"
    },
    "179b": function(t, e, s) {
        "use strict";
        s("33f6")
    },
    "19fb": function(t, e, s) {
        t.exports = s.p + "img/dom.fca4b729.png"
    },
    "1f1e": function(t, e) {
        t.exports = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAABmJLR0QA/wD/AP+gvaeTAAAPH0lEQVR4nO2deVRUR/bHv9XddLMIiIDKKuIy+guIO0skigtxV0w0GnfcTlwmROM5OnFJ4jjJzzUuMcFo3B2CIy6JmlEy7oBI3I0ZMz+N0aEVaHaBhu53f38AhqWbfq/7daPxfc7xHHnvVtVtvl3v1q2qVwASEhISEhISEhISEhISEhISEhISEhIvPqyxHRCTRCJ5qxx1F05OfcEhEoy1AdASgAsAPYCnANSM4S6IbhAnO53nUZw6mLXTNqrjNfhDCJKW9bAdyWRxYGwcADchZRmQzwGJjEN8uKf3FSu5KMSfF5e03IedAPlHRBgOQCZCld9zMm7xq26+10SoyyxeSEEyiOx0uY8XEWgJAKXI1esYsLm0ULs4qnXrMpHrNskLJ0hqnjoAekoCQxcrN3Wd6fWjw5r7/WLldmrxQgmSmpPZEQz/BOBnoyZzCTQswt0nxUbtvTiCXMxR95AxOgHA3cZNFxOxfhEeXum2aOyFECQjO9urQlZxBZVD2MYgh+n1EbZ4fIkxMrEqp4kU5bKKb9B4YgCAB8nlB1MePnSwdkPPvSAOeeqPGRDZ2H4ACGaO8pXWbuS5fmRVjah+BoOqsX2pQs/JuO7WzFMU1qpYFPS0sq4YRIQrR48h48hRZP/2G3TlFRY10Wv8WPSfNYOvuVzGyVYCGGJRow3w3PaQdI36FT3oBmo8VokIh1Z+ihsnkxHW5zUEd+sCBydHs9s4fuAA7t+9h8hJE9Fn6iS+xYhk1C3Czeeq2Q03wHPbQ/SEiWC1Y9y1Eydx42QyFqxYhgEjh1ncxtbV67B2x3y8N2UtFHYK9JrwNp9ijOnZTADvWOyAAZ7LoE5EDIzeqnv9xyNH0b1XuChiVNMqwB7rd72P5K3bkfrNAX6FGN66TbfFnrIBYOMecptuK4s17r30TD+IgYWBsZYg8kLlozOHgAeMWEpqrvoxAwLqln9y7z4GRPcT3a8/dWiCv30Rhw9mb4BcaYeeMSNNFXEryG8WDuCs2L7YRJDTWVlN7BUVcwo1bAEY58mqQxdRTTN/BviDUaSxwFah1cLZ1cUqPnbp7oaPNszD8nc3QSaTo/uIhnsh47govIiCpORkjmRM9xWIeTy/Q4hKeoS7Y+GK6Vi9bCPs7FUIeT362b3ivDxc2LUX/76YgsIcDZxcXRbHhHZvXVpQvPz7n3/+VSwfrBZDThMpUjWZ6xhDEgAPa7VjCTK5HJyeq3Ut6nU/zPtgMo58sgY3T/0AAHh46zbip0xHOy9PrPn6cxxKP431u7cqY8a/9bbKyeHmoJCgaEP1m4NVvrNExC7lPt5GoNgGbETNJ8ZMm4zYuLmCykwbOhLLVsXAP9Czzh0Z/rH3NnZsOoCBf56NlH0JWLpuJTp2CqpXx0/Xb2LJzHeLK0rKgo7fufPAgo8AwEqPrLS8xxtgQoya+cTQEUMtzicO7twDpVKFCbN5J3no3LMHLp6+Y0AQDm9OeAXaMh32b/wcrw6IMigGAPxPSDBGTRpnf3jfgY8ATDH7Q1QhuiBpuerBRDSvIRtr5hN2dgq8NWMqr3KjJk3EgslT0atfR/gF1Bdl/IwuKCutwOH9x3D5fAp6REYYrKfvsEGKQ3sThlr4MQAAcjEqqSZNo3Eh6I4DcG3I7tia9WjfoR1mvB8nSrsJX32NafN6IywqFJ8u2gBHJyd07NzJZDmXpq5o5umJVUu2wsXFHi183KBU1vyOcuga2gpZWRz2bNmJsTMMdwCVvQr7vtjuENImMLSNp8fWP3l5LQ5u7R/h4+Z06V6WJk/IZxG1hxBp54KZXs2zRT5hp1Ri2LjRJsv0HToY3n5+2Bcfjy/XnURJcYngdjXZOWBMxkaOH/N6dMxQmVyhQPKRYwP3x+/I6B/cvnvyzbv3+NYlmiCJRHLkqmfxsbVNPrEaMrkMQ8a8YbJMh5BgrNiy2ej944lJ2Ljik1rXknbtR3FxMVQqe7wxeRy+PLQXvgGtno1aR8dOVOj1euekXftXAzDtRBWiDXv98h5HA/AXqz5LqM4nNq9cheSjx6zSxqjJb2PSnJmIjO6LQ3sS4BvQqp7NwDdGKMpKS0cOCQnWvhkRmhEd1MFknBGthzBQJJk2swrG8oky7WSsW7oCcrkcUUMGWqVtb39fFBUWYfv6z2Fnp4CzqytiJo4FADRt5oZD6Wdk5WVa5bVLl7t9+elnCTE9nL44dPnHhcbqE00QItYTaBxJ3NzdkJNVCP8mNUdKhEHDA/G0YDRWLV6OS+cuILB9u1rlWrUNRGjvSFw6ex4P/nOv3nW+xMbNfvb/KylpuJKShq4RYQAAuVwOBydHhPftjaBuXZxmjhg7Nzqow9mTt37+zlBdFglCRCxd8yRKz7jhABkeE9qABvOJia9AWz4KCdsOo8+gaIT1ea1e+dDekYIEaIiQ0B7YseEL/HT9FuQyOd6cOh52ysqJYWdXF8z5y/v2m/76v8sBGBTE7BiSmqselJarvsox7gcGvAvA6hsAjDFq0kQcTbyMh79mG7jLYfz0LoiZMAR/nb8I6ecuWNUXuVyO6fPnYsI709Fv+GAk7U6odb9rRChKS0qDjZUXLMhx+kWVmvPfz0F0HECIcJfFxyfAHzMXLsCi2Xtx6turKC6uswOUdIidE4Z+Q1/DygWLbeZXc68WUCrtarti4rEu6JGVQWRXkfc4EYyG173X2bXycXGtwNC31PoIyScSt+9qsC6hMaQhYiaNq/XztbTLcHB0uGnMXpAgFRr1RjDUEwNoPCFqwjefGDNtsg29+p2igkLEr/rsaVFh0YfGbHgLUjVH9Szx6+zqCXt57eJlet1zIczzRknxU1xNS0f8qs+eFheXbPnnrTtGkyP+PYRoJWpM17+Mv/jBIeYNJBUKhdbB0eFmUVHRhw2JATQgCBHdBdDO2P1qinTluF2oqRVDavYePr2mbh4gFKH5hLkx5MNzP5jjni7c3duer7FRQRhj7av/n6LJ/KxqaGuUmr90ob1HrDyAbz02jiFFQoxNPrKqe0r1N91YTzBGqV6H6y/h460Ggj68SUEYY+1TczKzwOAJWNYTXkYIuCHEnl9QZ/UXnKp7hxgjK0tjiDHEjiHmIAO7JMSelyAEaBjgVfOamL1DzLkkPtgyhjBOf1SIPd+pk/+a4ctLDwHnQz197wopw0sQBpw3z6WXHGLbhBbh98iSsSOMo/eEe8SPP2oMYaBlGdnZp7p7eqr5luElSHjTlufTNOqr1no3/A8bQxjaVMgqvssgCuvOGK+dgPweWYxxjGGRZd69pBC66nIf/5mvOe/1kDB375MANprl1EsOgZZfyM525mMraPq9rJnXAnvN49ZgJN4bM6gfQ+rOTRmbqzKFmPmEhTgr5BUjAOw1ZShIkCjGdKeJRqly1WtMzW0JwVgMqXvd1rFGTIgwCjwEEbyEG8WYLsLdOw5EA8DQ6OdL2YKiggLYqSx7M5uA9qatLNh1Eu7hk0xEPVLy1b1kHEYAiASYD0AtIPKe4cbm2uUMtGzbhre9kcW7jnzKWrQNiDHGAThX9e8ZqZpMHQSIYus8RAjfHzyMq6npiFnCf5BpZFrpKZ+y1nqlrRRAk+ofdOVanN+zH7dP/Qv5OdlwcHTCjxdT0X/4EChVKpvHhuMHkkzalDwtwfXLGbh87iK6DHwdnQb0f3aPz7ID8PviXJW9MxHdrbnOZAirvEGVqsl8BMAHqNxYvSfufTRv5oYJ78TCP7A1Hv36AHu2fIWykjL8LX7Ts41k1sbQpmljKJR28AxohZ4xI9F58EAwZvGvKinc3dvkpmtrCXIeQC8AOPP1ThT/3z18vHl1LRviOKyYvxieLVuiML8AV9PSUVFeji5hPREbN9fg5mVLqRbEzKXYelT3lIIKLe4U5QpevKvil5q9xiqPLAJ+YlWC3Dr5A5asXVHPhslkmDB7Bt4bPx1vz4rF9PlzADD867sTWDh1FjYl7IJHixbWcE806sYKY4t3DMgvlWlbR7m1zjdVp+iCdOvWzW5P3ILAJ/fuQ8YYivMLENAm0KBtYPu2SDh7Ag6Ov+9CHR07EURA/Or1+GDNp2K7ZxPqLt4Ro0/4iAFYQZBWcrbOVaV89aMDu0FEuJh8psEYUVOMavoNG4TEr3eL7Zoo+QQf6vSc9LKCct5TTqIIEh0U5NekicPWstKyPlptmXLBiqWyZp6VRyOOGD9GUF1EhF9+ugNtmRZLZ7+L2X9ZCC9fXzHcFJxPiMBDPaeLEXLcrMVvUEUHBfnZq+xujpk6of/OE0n2h9LPPBPDHL7ZthtOzs7YcnAv2nZoj4VTZkH96JGlbj7LJ7rHGNwJaw3S9ZwurJenf6aQQhb3kCZNHLaOnjLeafS0SaL0NpW9CsHdOgMAJs6dCXtHB6xevBz9h5t3ZlhD+YQ1YEA+Mfokz61kgzlnyls87B0cEly680SSvXtz65yekZeTi9jBo6DVlptVXux8ggHnCMgB0BVAcwAcgEcA7oDYkTJ52RG+AdygvxZ5ZwM4Tg+ZQokPT51obFcAoEDB2Y0VsiQrFItjiMpedS75yHc6MZwxRPLR42jTo6u1qhcCEdgMa4oBiDArG+DufPnO9duTGaDw8vOVOVpwZklNNFnZ+Pbv/8ChfYkYufQDOLqY/V47B9AugAXD/C8gxxibF+7u1fDuCBEQZepkUKe2vg6OTePLSrV99Tqd0Z3eXv6+2P5tIpbNXYCPN6/FjOGVp/h9dfQbTBs2Burffh9N2Ts5oW2PboiaOR3uvj5m+0ZE8yI8fDZfylUP4Yj2o/KPu/CGAfkApoe5ex802wlh7dmOVE3mewDW2qhdDkRx4R4+m6ovpD150gIK/UcETIPp+KkHsFcOWtrT3eehVT2tgc3PeEvVqMcAtA0Ar0V/MykEYWq4h7fBefYL2b95y+V2I4hoCAMCUfnXFuSoPPfxhgzsDEe6v0d4+Nl8x2ajHLqXlvWwHcnlOwC8aoXqL8jkskmhTVvet0LdVqfRTkGsPHUucwqBLYOBE0jN4AExWhzu5p3AGGusUz4sptGPpcwgstNp1GNJhqkg9IawkZCeQGcB2ZfKZi0P890d+DzT6ILUJCM720snr+gHQi8idABDW1QuBbsyIJ+AAjDcB9gtgNJkCu77UBdfTWP7LSEhISEhISEhISEhISEhISEhISEhIVGb/wcpmMnVTjDMgwAAAABJRU5ErkJggg=="
    },
    "1f5a": function(t, e, s) {
        "use strict";
        s("ba55")
    },
    "1f5b": function(t, e, s) {
        t.exports = s.p + "img/car.186a0854.png"
    },
    "24a3": function(t, e, s) {
        "use strict";
        s("54e2")
    },
    "277a": function(t, e, s) {
        t.exports = s.p + "img/borderWaves.b5381f92.svg"
    },
    "294e": function(t, e, s) {
        t.exports = s.p + "img/investicii.5c0e7d6e.png"
    },
    "2d61": function(t, e, s) {
        "use strict";
        s("69ef")
    },
    "2d67": function(t, e, s) {},
    "307c": function(t, e, s) {
        t.exports = s.p + "img/6.d469a611.png"
    },
    "30a4": function(t, e, s) {
        t.exports = s.p + "img/1.e8f06511.jpg"
    },
    "30f8": function(t, e, s) {
        t.exports = s.p + "img/pers.aa2099de.png"
    },
    3279: function(t, e, s) {
        t.exports = s.p + "img/wa2.af407d81.png"
    },
    "33f6": function(t, e, s) {},
    "36f2": function(t, e, s) {
        t.exports = s.p + "img/whatsapp_logo.50d6310b.png"
    },
    3825: function(t, e, s) {
        "use strict";
        s("d562")
    },
    "40ca": function(t, e, s) {
        t.exports = s.p + "img/lecenie.899a72d2.png"
    },
    4678: function(t, e, s) {
        var a = {
            "./af": "2bfb",
            "./af.js": "2bfb",
            "./ar": "8e73",
            "./ar-dz": "a356",
            "./ar-dz.js": "a356",
            "./ar-kw": "423e",
            "./ar-kw.js": "423e",
            "./ar-ly": "1cfd",
            "./ar-ly.js": "1cfd",
            "./ar-ma": "0a84",
            "./ar-ma.js": "0a84",
            "./ar-sa": "8230",
            "./ar-sa.js": "8230",
            "./ar-tn": "6d83",
            "./ar-tn.js": "6d83",
            "./ar.js": "8e73",
            "./az": "485c",
            "./az.js": "485c",
            "./be": "1fc1",
            "./be.js": "1fc1",
            "./bg": "84aa",
            "./bg.js": "84aa",
            "./bm": "a7fa",
            "./bm.js": "a7fa",
            "./bn": "9043",
            "./bn-bd": "9686",
            "./bn-bd.js": "9686",
            "./bn.js": "9043",
            "./bo": "d26a",
            "./bo.js": "d26a",
            "./br": "6887",
            "./br.js": "6887",
            "./bs": "2554",
            "./bs.js": "2554",
            "./ca": "d716",
            "./ca.js": "d716",
            "./cs": "3c0d",
            "./cs.js": "3c0d",
            "./cv": "03ec",
            "./cv.js": "03ec",
            "./cy": "9797",
            "./cy.js": "9797",
            "./da": "0f14",
            "./da.js": "0f14",
            "./de": "b469",
            "./de-at": "b3eb",
            "./de-at.js": "b3eb",
            "./de-ch": "bb71",
            "./de-ch.js": "bb71",
            "./de.js": "b469",
            "./dv": "598a",
            "./dv.js": "598a",
            "./el": "8d47",
            "./el.js": "8d47",
            "./en-au": "0e6b",
            "./en-au.js": "0e6b",
            "./en-ca": "3886",
            "./en-ca.js": "3886",
            "./en-gb": "39a6",
            "./en-gb.js": "39a6",
            "./en-ie": "e1d3",
            "./en-ie.js": "e1d3",
            "./en-il": "7333",
            "./en-il.js": "7333",
            "./en-in": "ec2e",
            "./en-in.js": "ec2e",
            "./en-nz": "6f50",
            "./en-nz.js": "6f50",
            "./en-sg": "b7e9",
            "./en-sg.js": "b7e9",
            "./eo": "65db",
            "./eo.js": "65db",
            "./es": "898b",
            "./es-do": "0a3c",
            "./es-do.js": "0a3c",
            "./es-mx": "b5b7",
            "./es-mx.js": "b5b7",
            "./es-us": "55c9",
            "./es-us.js": "55c9",
            "./es.js": "898b",
            "./et": "ec18",
            "./et.js": "ec18",
            "./eu": "0ff2",
            "./eu.js": "0ff2",
            "./fa": "8df4",
            "./fa.js": "8df4",
            "./fi": "81e9",
            "./fi.js": "81e9",
            "./fil": "d69a",
            "./fil.js": "d69a",
            "./fo": "0721",
            "./fo.js": "0721",
            "./fr": "9f26",
            "./fr-ca": "d9f8",
            "./fr-ca.js": "d9f8",
            "./fr-ch": "0e49",
            "./fr-ch.js": "0e49",
            "./fr.js": "9f26",
            "./fy": "7118",
            "./fy.js": "7118",
            "./ga": "5120",
            "./ga.js": "5120",
            "./gd": "f6b4",
            "./gd.js": "f6b4",
            "./gl": "8840",
            "./gl.js": "8840",
            "./gom-deva": "aaf2",
            "./gom-deva.js": "aaf2",
            "./gom-latn": "0caa",
            "./gom-latn.js": "0caa",
            "./gu": "e0c5",
            "./gu.js": "e0c5",
            "./he": "c7aa",
            "./he.js": "c7aa",
            "./hi": "dc4d",
            "./hi.js": "dc4d",
            "./hr": "4ba9",
            "./hr.js": "4ba9",
            "./hu": "5b14",
            "./hu.js": "5b14",
            "./hy-am": "d6b6",
            "./hy-am.js": "d6b6",
            "./id": "5038",
            "./id.js": "5038",
            "./is": "0558",
            "./is.js": "0558",
            "./it": "6e98",
            "./it-ch": "6f12",
            "./it-ch.js": "6f12",
            "./it.js": "6e98",
            "./ja": "079e",
            "./ja.js": "079e",
            "./jv": "b540",
            "./jv.js": "b540",
            "./ka": "201b",
            "./ka.js": "201b",
            "./kk": "6d79",
            "./kk.js": "6d79",
            "./km": "e81d",
            "./km.js": "e81d",
            "./kn": "3e92",
            "./kn.js": "3e92",
            "./ko": "22f8",
            "./ko.js": "22f8",
            "./ku": "2421",
            "./ku.js": "2421",
            "./ky": "9609",
            "./ky.js": "9609",
            "./lb": "440c",
            "./lb.js": "440c",
            "./lo": "b29d",
            "./lo.js": "b29d",
            "./lt": "26f9",
            "./lt.js": "26f9",
            "./lv": "b97c",
            "./lv.js": "b97c",
            "./me": "293c",
            "./me.js": "293c",
            "./mi": "688b",
            "./mi.js": "688b",
            "./mk": "6909",
            "./mk.js": "6909",
            "./ml": "02fb",
            "./ml.js": "02fb",
            "./mn": "958b",
            "./mn.js": "958b",
            "./mr": "39bd",
            "./mr.js": "39bd",
            "./ms": "ebe4",
            "./ms-my": "6403",
            "./ms-my.js": "6403",
            "./ms.js": "ebe4",
            "./mt": "1b45",
            "./mt.js": "1b45",
            "./my": "8689",
            "./my.js": "8689",
            "./nb": "6ce3",
            "./nb.js": "6ce3",
            "./ne": "3a39",
            "./ne.js": "3a39",
            "./nl": "facd",
            "./nl-be": "db29",
            "./nl-be.js": "db29",
            "./nl.js": "facd",
            "./nn": "b84c",
            "./nn.js": "b84c",
            "./oc-lnc": "167b",
            "./oc-lnc.js": "167b",
            "./pa-in": "f3ff",
            "./pa-in.js": "f3ff",
            "./pl": "8d57",
            "./pl.js": "8d57",
            "./pt": "f260",
            "./pt-br": "d2d4",
            "./pt-br.js": "d2d4",
            "./pt.js": "f260",
            "./ro": "972c",
            "./ro.js": "972c",
            "./ru": "957c",
            "./ru.js": "957c",
            "./sd": "6784",
            "./sd.js": "6784",
            "./se": "ffff",
            "./se.js": "ffff",
            "./si": "eda5",
            "./si.js": "eda5",
            "./sk": "7be6",
            "./sk.js": "7be6",
            "./sl": "8155",
            "./sl.js": "8155",
            "./sq": "c8f3",
            "./sq.js": "c8f3",
            "./sr": "cf1e",
            "./sr-cyrl": "13e9",
            "./sr-cyrl.js": "13e9",
            "./sr.js": "cf1e",
            "./ss": "52bd",
            "./ss.js": "52bd",
            "./sv": "5fbd",
            "./sv.js": "5fbd",
            "./sw": "74dc",
            "./sw.js": "74dc",
            "./ta": "3de5",
            "./ta.js": "3de5",
            "./te": "5cbb",
            "./te.js": "5cbb",
            "./tet": "576c",
            "./tet.js": "576c",
            "./tg": "3b1b",
            "./tg.js": "3b1b",
            "./th": "10e8",
            "./th.js": "10e8",
            "./tk": "5aff",
            "./tk.js": "5aff",
            "./tl-ph": "0f38",
            "./tl-ph.js": "0f38",
            "./tlh": "cf75",
            "./tlh.js": "cf75",
            "./tr": "0e81",
            "./tr.js": "0e81",
            "./tzl": "cf51",
            "./tzl.js": "cf51",
            "./tzm": "c109",
            "./tzm-latn": "b53d",
            "./tzm-latn.js": "b53d",
            "./tzm.js": "c109",
            "./ug-cn": "6117",
            "./ug-cn.js": "6117",
            "./uk": "ada2",
            "./uk.js": "ada2",
            "./ur": "5294",
            "./ur.js": "5294",
            "./uz": "2e8c",
            "./uz-latn": "010e",
            "./uz-latn.js": "010e",
            "./uz.js": "2e8c",
            "./vi": "2921",
            "./vi.js": "2921",
            "./x-pseudo": "fd7e",
            "./x-pseudo.js": "fd7e",
            "./yo": "7f33",
            "./yo.js": "7f33",
            "./zh-cn": "5c3a",
            "./zh-cn.js": "5c3a",
            "./zh-hk": "49ab",
            "./zh-hk.js": "49ab",
            "./zh-mo": "3a6c",
            "./zh-mo.js": "3a6c",
            "./zh-tw": "90ea",
            "./zh-tw.js": "90ea"
        };

        function i(t) {
            var e = r(t);
            return s(e)
        }

        function r(t) {
            if (!s.o(a, t)) {
                var e = new Error("Cannot find module '" + t + "'");
                throw e.code = "MODULE_NOT_FOUND", e
            }
            return a[t]
        }
        i.keys = function() {
            return Object.keys(a)
        }, i.resolve = r, t.exports = i, i.id = "4678"
    },
    "4d31": function(t, e, s) {
        "use strict";
        s("68ef")
    },
    "4fa1": function(t, e, s) {
        t.exports = s.p + "img/ipoteka.41e91ee4.png"
    },
    5112: function(t, e, s) {
        "use strict";
        s("e4be")
    },
    5471: function(t, e, s) {
        "use strict";
        s("963f")
    },
    "54c1": function(t, e, s) {
        t.exports = s.p + "img/exp5.da713e93.png"
    },
    "54e2": function(t, e, s) {},
    "552a": function(t, e, s) {
        "use strict";
        s("7519")
    },
    "56d7": function(t, e, s) {
        "use strict";
        s.r(e);
        s("e260"), s("e6cf"), s("cca6"), s("a79d");
        var a = s("2b0e"),
            i = s("1dce"),
            r = s.n(i),
            n = function() {
                var t = this,
                    e = t.$createElement,
                    s = t._self._c || e;
                return s("v-app", [s("navigation", {
                    attrs: {
                        color: t.color,
                        flat: t.flat
                    }
                }), s("v-main", {
                    staticClass: "pt-0"
                }, [s("home"), s("order"), s("call_dialog"), s("pricing"), s("sec1"), s("expert"), s("stock"), s("situation"), s("advantages"), s("feedback"), s("request"), s("contact"), s("faq_panel")], 1), s("v-scale-transition", [s("v-btn", {
                    directives: [{
                        name: "show",
                        rawName: "v-show",
                        value: t.fab,
                        expression: "fab"
                    }, {
                        name: "scroll",
                        rawName: "v-scroll",
                        value: t.onScroll,
                        expression: "onScroll"
                    }],
                    attrs: {
                        fab: "",
                        dark: "",
                        fixed: "",
                        bottom: "",
                        right: "",
                        color: "secondary"
                    },
                    on: {
                        click: t.toTop
                    }
                }, [s("v-icon", [t._v("mdi-arrow-up")])], 1)], 1), s("foote"), s("info_panel")], 1)
            },
            o = [],
            c = (s("0481"), function() {
                var t = this,
                    e = t.$createElement,
                    a = t._self._c || e;
                return a("div", [a("v-navigation-drawer", {
                    attrs: {
                        app: "",
                        temporary: ""
                    },
                    model: {
                        value: t.drawer,
                        callback: function(e) {
                            t.drawer = e
                        },
                        expression: "drawer"
                    }
                }, [a("v-list", [a("v-list-item", [a("img", {
                    staticClass: "mobile-logo",
                    attrs: {
                        src: s("a1d8"),
                        alt: "Налог сервис"
                    }
                })])], 1), a("v-divider"), a("v-list", {
                    attrs: {
                        dense: ""
                    }
                }, t._l(t.items, (function(e, s) {
                    var i = e[0],
                        r = e[1],
                        n = e[2];
                    return a("v-list-item", {
                        key: s,
                        attrs: {
                            link: ""
                        },
                        on: {
                            click: function(e) {
                                return t.$vuetify.goTo(n)
                            }
                        }
                    }, [a("v-list-item-icon", {
                        staticClass: "justify-center"
                    }, [a("v-icon", [t._v(t._s(i))])], 1), a("v-list-item-content", [a("v-list-item-title", {
                        staticClass: "subtitile-1"
                    }, [t._v(t._s(r) + " ")])], 1)], 1)
                })), 1)], 1), a("v-app-bar", {
                    staticClass: "px-15",
                    class: {
                        expand: t.flat
                    },
                    attrs: {
                        app: "",
                        color: "white",
                        flat: t.flat
                    }
                }, [t.isXs ? a("v-app-bar-nav-icon", {
                    staticClass: "mr-4",
                    on: {
                        click: function(e) {
                            e.stopPropagation(), t.drawer = !t.drawer
                        }
                    }
                }) : t._e(), a("div", {
                    staticStyle: {
                        width: "100%"
                    }
                }, [a("v-flex", {
                    staticClass: "header-top",
                    attrs: {
                        xs12: "",
                        sm12: "",
                        md12: "",
                        lg8: "",
                        "offset-lg2": ""
                    }
                }, [a("table", [a("tr", [a("td", {
                    staticClass: "logo"
                }, [a("img", {
                    staticClass: "app-logo",
                    attrs: {
                        src: s("a1d8"),
                        alt: "Налог сервис"
                    }
                })]), a("td", {
                    staticClass: "text"
                }, [a("a", {
                    staticStyle: {
                        "text-decoration-line": "none",
                        color: "#005096"
                    },
                    attrs: {
                        href: "tel:+79208379193"
                    }
                }, [t._v("+7 (920) 837-91-93")]), a("br")]), a("td", {
                    staticClass: "btn"
                }, [a("v-btn", {
                    staticClass: "call-btn",
                    attrs: {
                        small: "",
                        dark: ""
                    },
                    on: {
                        click: function(e) {
                            return t.$vuetify.goTo("#dialog")
                        }
                    }
                }, [t._v("Заказать звонок")])], 1), a("td", {
                    staticClass: "btn"
                }, [a("v-btn", {
                    staticClass: "call-btn",
                    attrs: {
                        small: "",
                        dark: ""
                    },
                    on: {
                        click: function(e) {
                            return t.$vuetify.goTo("#request")
                        }
                    }
                }, [t._v("Заказать услугу")])], 1)])])]), t.isXs ? t._e() : a("v-flex", {
                    attrs: {
                        xs12: "",
                        sm12: "",
                        md12: "",
                        lg8: "",
                        "offset-lg2": ""
                    }
                }, [a("v-tabs", {
                    staticClass: "header-menu",
                    attrs: {
                        centered: "",
                        grow: "",
                        color: "#005096"
                    }
                }, t._l(t.items, (function(e, s) {
                    e[0];
                    var i = e[1],
                        r = e[2];
                    return a("v-tab", {
                        key: s,
                        on: {
                            click: function(e) {
                                return t.$vuetify.goTo(r)
                            }
                        }
                    }, [t._v(" " + t._s(i) + " ")])
                })), 1)], 1)], 1)], 1)], 1)
            }),
            l = [],
            f = {
                data: function() {
                    return {
                        drawer: null,
                        isXs: !1,
                        items: [
                            ["mdi-star-outline", "Как заказать", "#order"],
                            ["mdi-currency-rub", "Цены", "#pricing"],
                            ["mdi-download-box-outline", "Ситуация", "#situation"],
                            ["mdi-comment-text-outline", "Отзывы", "#comment"],
                            ["mdi-contacts-outline", "Контакты", "#contact"]
                        ]
                    }
                },
                props: {
                    color: String,
                    flat: Boolean
                },
                methods: {
                    onResize: function() {
                        this.isXs = window.innerWidth < 850
                    }
                },
                watch: {
                    isXs: function(t) {
                        t || this.drawer && (this.drawer = !1)
                    }
                },
                mounted: function() {
                    this.onResize(), window.addEventListener("resize", this.onResize, {
                        passive: !0
                    })
                }
            },
            u = f,
            d = (s("08b3"), s("2877")),
            p = s("6544"),
            m = s.n(p),
            v = s("40dc"),
            h = s("5bc1"),
            b = s("8336"),
            g = s("ce7e"),
            x = s("0e8f"),
            C = s("132d"),
            j = s("8860"),
            y = s("da13"),
            w = s("5d23"),
            _ = s("34c3"),
            k = s("f774"),
            V = s("71a3"),
            E = s("fe57"),
            P = Object(d["a"])(u, c, l, !1, null, "4bd5b087", null),
            A = P.exports;
        m()(P, {
            VAppBar: v["a"],
            VAppBarNavIcon: h["a"],
            VBtn: b["a"],
            VDivider: g["a"],
            VFlex: x["a"],
            VIcon: C["a"],
            VList: j["a"],
            VListItem: y["a"],
            VListItemContent: w["a"],
            VListItemIcon: _["a"],
            VListItemTitle: w["b"],
            VNavigationDrawer: k["a"],
            VTab: V["a"],
            VTabs: E["a"]
        });
        var T = function() {
                var t = this,
                    e = t.$createElement,
                    s = t._self._c || e;
                return s("v-footer", {
                    attrs: {
                        padless: ""
                    }
                }, [s("v-card", {
                    staticClass: "text-center",
                    staticStyle: {
                        "background-color": "rgba(229,243,252,0.5)"
                    },
                    attrs: {
                        tile: ""
                    }
                }, [s("v-card-text", t._l(t.icons, (function(e, a) {
                    return s("v-btn", {
                        key: a,
                        attrs: {
                            href: e.link,
                            target: "_blank",
                            icon: ""
                        }
                    }, [s("v-icon", {
                        attrs: {
                            size: "24px"
                        }
                    }, [t._v(t._s(e.text))])], 1)
                })), 1), s("v-card-text", {
                    staticClass: "pt-0"
                }, [s("a", {
                    attrs: {
                        href: "/policy.html"
                    }
                }, [t._v("Политика конфиденциальности")]), s("a", {
                    staticClass: "pa-2",
                    attrs: {
                        href: "/offer.html"
                    }
                }, [t._v("Публичная оферта")])]), s("v-divider"), s("v-card-text", [t._v(" ООО «Информкарт» использует файлы cookie с целью персонализации сервисов и повышения удобства пользования веб-сайтом. "), s("br"), t._v("Если вы не хотите использовать файлы cookie, измените настройки браузера. ")])], 1)], 1)
            },
            q = [],
            O = {
                data: function() {
                    return {
                        icons: []
                    }
                }
            },
            $ = O,
            S = (s("24a3"), s("b0af")),
            I = s("99d9"),
            R = s("553a"),
            B = Object(d["a"])($, T, q, !1, null, "8e2e7ce8", null),
            L = B.exports;
        m()(B, {
            VBtn: b["a"],
            VCard: S["a"],
            VCardText: I["a"],
            VDivider: g["a"],
            VFooter: R["a"],
            VIcon: C["a"]
        });
        var z = function() {
                var t = this,
                    e = t.$createElement,
                    a = t._self._c || e;
                return a("section", [a("v-parallax", {
                    attrs: {
                        src: s("5c4f"),
                        height: "600"
                    }
                }, [a("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [a("v-col", {
                    attrs: {
                        cols: "10"
                    }
                }, [a("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [a("v-col", {
                    attrs: {
                        cols: "12",
                        md: "9",
                        xl: "9"
                    }
                }, [a("h1", {
                    staticClass: "h1-title mt-15"
                }, [t._v("Получите"), a("br"), t._v(" налоговый вычет")]), a("h1", {
                    staticClass: "h2-title"
                }, [t._v(" Оставьте заявку онлайн"), a("br"), t._v(" и получите налоговый вычет."), a("br"), t._v(" Гарантия качества услуг. "), a("br"), t._v(" Оплата по факту. ")]), a("v-btn", {
                    staticClass: "call-btn-2",
                    attrs: {
                        large: ""
                    },
                    on: {
                        click: function(e) {
                            return t.$vuetify.goTo("#request")
                        }
                    }
                }, [t._v(" Получить налоговый вычет ")])], 1)], 1)], 1)], 1), a("div", {
                    staticClass: "svg-border-waves text-white"
                }, [a("v-img", {
                    attrs: {
                        eager: !0,
                        src: s("277a")
                    }
                })], 1)], 1)], 1)
            },
            N = [],
            D = {
                data: function() {
                    return {}
                }
            },
            M = D,
            Y = (s("7ffa"), s("62ad")),
            H = s("adda"),
            W = s("8b9c"),
            J = s("0fd9"),
            G = Object(d["a"])(M, z, N, !1, null, "3c39a509", null),
            Z = G.exports;
        m()(G, {
            VBtn: b["a"],
            VCol: Y["a"],
            VImg: H["a"],
            VParallax: W["a"],
            VRow: J["a"]
        });
        var Q = function() {
                var t = this,
                    e = t.$createElement,
                    a = t._self._c || e;
                return a("section", {
                    attrs: {
                        id: "order"
                    }
                }, [a("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [a("v-col", {
                    attrs: {
                        cols: "10"
                    }
                }, [a("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [a("v-col", {
                    attrs: {
                        cols: "12",
                        md: "9",
                        xl: "9"
                    }
                }, [a("div", {
                    staticClass: "text-center mt-10"
                }, [a("h1", {
                    staticClass: "section-title font-weight-light"
                }, [t._v("4 шага получить налоговый вычет")])]), a("div", {
                    staticClass: "row mt-10 align-center justify-center steps"
                }, [a("div", {
                    staticClass: "d-flex col-sm-12 col-md-12 col-lg-6 col-xl-6 col-12"
                }, [a("table", {
                    staticClass: "order-info-table"
                }, [a("tr", {
                    staticClass: "border-tr"
                }, [a("td", {
                    staticClass: "title",
                    attrs: {
                        colspan: "4"
                    }
                }, [t._v("Вы")])]), a("tr", [a("td", {
                    staticClass: "img-info"
                }, [a("div", {
                    staticClass: "v-avatar rounded-0 d-none d-sm-flex"
                }, [a("v-img", {
                    attrs: {
                        eager: !0,
                        src: s("1284")
                    }
                })], 1)]), a("td", {
                    staticClass: "text-info"
                }, [a("h4", [t._v("1. Оставляете"), a("br"), t._v("заявку")]), a("p", [t._v("Ответим на Ваши вопросы, сформируем список документов для декларации, ознакомим с Договором оферты и Политикой конфиденциальности")])]), a("td", {
                    staticClass: "img-info"
                }, [a("div", {
                    staticClass: "v-avatar rounded-0 d-none d-sm-flex"
                }, [a("v-img", {
                    attrs: {
                        eager: !0,
                        src: s("750f")
                    }
                })], 1)]), a("td", {
                    staticClass: "text-info"
                }, [a("h4", [t._v("2. Отправляете"), a("br"), t._v("документы")]), a("p", [t._v("Помогаем собрать документы и проверяем их.")])])])])]), a("div", {
                    staticClass: "d-flex col-sm-12 col-md-12 col-lg-6 col-xl-6 col-12"
                }, [a("table", {
                    staticClass: "order-info-table"
                }, [a("tr", {
                    staticClass: "border-tr"
                }, [a("td", {
                    staticClass: "title",
                    attrs: {
                        colspan: "4"
                    }
                }, [t._v("Мы")])]), a("tr", [a("td", {
                    staticClass: "img-info"
                }, [a("div", {
                    staticClass: "v-avatar rounded-0 d-none d-sm-flex"
                }, [a("v-img", {
                    attrs: {
                        eager: !0,
                        src: s("5d1a")
                    }
                })], 1)]), a("td", {
                    staticClass: "text-info"
                }, [a("h4", [t._v("3. Формируем"), a("br"), t._v("декларацию")]), a("p", [t._v("Заполняем декларацию и заявление, отправляем документы Вам")])]), a("td", {
                    staticClass: "img-info"
                }, [a("div", {
                    staticClass: "v-avatar rounded-0 d-none d-sm-flex"
                }, [a("v-img", {
                    attrs: {
                        eager: !0,
                        src: s("d925")
                    }
                })], 1)]), a("td", {
                    staticClass: "text-info"
                }, [a("h4", [t._v("4. Подаем"), a("br"), t._v("декларацию")]), a("p", [t._v("Отправляем декларацию в налоговую, или вы сдаете ее сами.")])])])])])])])], 1)], 1)], 1), a("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [a("v-col", {
                    attrs: {
                        cols: "10"
                    }
                }, [a("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [a("v-col", {
                    staticClass: "mt-10",
                    attrs: {
                        cols: "12",
                        md: "9",
                        xl: "9"
                    }
                }, [a("div", {
                    staticClass: "text-center"
                }, [a("h2", {
                    staticClass: "section-title-2 font-weight-light"
                }, [t._v("Вы получаете налоговый вычет")]), a("p", {
                    staticClass: "mt-3 font-weight-light"
                }, [t._v("Деньги придут на карту в течение 4-х месяцев")]), a("v-btn", {
                    staticClass: "order-btn mt-2",
                    attrs: {
                        large: "",
                        dark: ""
                    },
                    on: {
                        click: function(e) {
                            return t.$vuetify.goTo("#request")
                        }
                    }
                }, [t._v("Получить налоговый вычет")])], 1)])], 1)], 1)], 1)], 1)
            },
            X = [],
            F = {
                data: function() {
                    return {}
                }
            },
            K = F,
            U = (s("552a"), Object(d["a"])(K, Q, X, !1, null, null, null)),
            tt = U.exports;
        m()(U, {
            VBtn: b["a"],
            VCol: Y["a"],
            VImg: H["a"],
            VRow: J["a"]
        });
        var et = function() {
                var t = this,
                    e = t.$createElement,
                    a = t._self._c || e;
                return a("section", {
                    attrs: {
                        id: "section1"
                    }
                }, [a("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [a("v-col", {
                    attrs: {
                        cols: "10"
                    }
                }, [a("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [a("v-col", {
                    attrs: {
                        cols: "12",
                        md: "9",
                        xl: "9"
                    }
                }, [a("div", {
                    staticClass: "text-center mt-4"
                }, [a("h1", {
                    staticClass: "section-title font-weight-light"
                }, [t._v("С нами вернете больше и быстрее")])])]), a("v-col", {
                    staticClass: "mt-6 mb-6 section1-cards",
                    staticStyle: {
                        "padding-left": "0",
                        "padding-right": "0"
                    },
                    attrs: {
                        cols: "12",
                        md: "9",
                        xl: "9"
                    }
                }, [a("v-row", [a("v-col", {
                    attrs: {
                        cols: "12",
                        sm: "3"
                    }
                }, [a("v-card", {
                    staticClass: "card pa-4 text-center",
                    attrs: {
                        elevation: "0"
                    }
                }, [a("div", [a("v-img", {
                    staticClass: "d-block ml-auto mr-auto",
                    attrs: {
                        eager: !0,
                        src: s("9629"),
                        "max-width": "100px"
                    }
                })], 1), a("h1", {
                    staticClass: "font-weight-regular"
                }, [t._v("Оплата по факту")]), a("h4", {
                    staticClass: "font-weight-regular subtitle-1"
                }, [t._v(" Мы берем оплату только по факту готовности документов. ")])])], 1), a("v-col", {
                    attrs: {
                        cols: "12",
                        sm: "3"
                    }
                }, [a("v-card", {
                    staticClass: "card pa-4 text-center",
                    attrs: {
                        elevation: "0"
                    }
                }, [a("div", [a("v-img", {
                    staticClass: "d-block ml-auto mr-auto",
                    attrs: {
                        eager: !0,
                        src: s("c0e6"),
                        "max-width": "100px"
                    }
                })], 1), a("h1", {
                    staticClass: "font-weight-regular"
                }, [t._v("Гарантия качества")]), a("h4", {
                    staticClass: "font-weight-regular subtitle-1"
                }, [t._v(" В случае отказа Налоговой мы бесплатно скорректируем документы или вернем вам деньги ")])])], 1), a("v-col", {
                    attrs: {
                        cols: "12",
                        sm: "3"
                    }
                }, [a("v-card", {
                    staticClass: "card pa-4 text-center",
                    attrs: {
                        elevation: "0"
                    }
                }, [a("div", [a("v-img", {
                    staticClass: "d-block ml-auto mr-auto",
                    attrs: {
                        eager: !0,
                        src: s("a8e6"),
                        "max-width": "100px"
                    }
                })], 1), a("h1", {
                    staticClass: "font-weight-regular"
                }, [t._v("Экономьте свое время")]), a("h4", {
                    staticClass: "font-weight-regular subtitle-1"
                }, [t._v(" Мы сэкономим ваше время и подготовим необходимые документы. ")])])], 1), a("v-col", {
                    attrs: {
                        cols: "12",
                        sm: "3"
                    }
                }, [a("v-card", {
                    staticClass: "card pa-4 text-center",
                    attrs: {
                        elevation: "0"
                    }
                }, [a("div", [a("v-img", {
                    staticClass: "d-block ml-auto mr-auto",
                    attrs: {
                        eager: !0,
                        src: s("9629"),
                        "max-width": "100px"
                    }
                })], 1), a("h1", {
                    staticClass: "font-weight-regular"
                }, [t._v("Получите максимальный вычет")]), a("h4", {
                    staticClass: "font-weight-regular subtitle-1"
                }, [t._v(" Мы грамотно оптимизируем налоги с максимальной выгодой для вас. ")])])], 1)], 1)], 1)], 1)], 1)], 1)], 1)
            },
            st = [],
            at = {
                data: function() {
                    return {}
                }
            },
            it = at,
            rt = (s("179b"), Object(d["a"])(it, et, st, !1, null, null, null)),
            nt = rt.exports;
        m()(rt, {
            VCard: S["a"],
            VCol: Y["a"],
            VImg: H["a"],
            VRow: J["a"]
        });
        var ot = function() {
                var t = this,
                    e = t.$createElement,
                    s = t._self._c || e;
                return s("section", {
                    staticClass: "pb-8 pt-10",
                    staticStyle: {
                        "background-color": "rgba(229,243,252,0.5)"
                    },
                    attrs: {
                        id: "pricing"
                    }
                }, [s("v-container", {
                    attrs: {
                        fluid: ""
                    }
                }, [s("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [s("v-col", {
                    attrs: {
                        cols: "10"
                    }
                }, [s("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [s("v-col", {
                    attrs: {
                        cols: "12",
                        md: "9",
                        xl: "9"
                    }
                }, [s("div", {
                    staticClass: "text-center mt-4"
                }, [s("h1", {
                    staticClass: "section-title font-weight-light"
                }, [t._v("Выберите удобный тариф")]), s("h4", {
                    staticClass: "section-subtitle font-weight-light"
                }, [t._v("Оплата после подготовки ваших документов")])])])], 1), s("v-row", {
                    staticClass: "mt-6",
                    attrs: {
                        align: "center",
                        justify: "space-around"
                    }
                }, [s("v-col", {
                    attrs: {
                        cols: "12",
                        md: "9",
                        xl: "9"
                    }
                }, [s("v-row", t._l(t.prices, (function(e, a) {
                    return s("v-col", {
                        key: a,
                        staticClass: "text-center",
                        attrs: {
                            cols: "12",
                            sm: "12",
                            xs: "6",
                            md: "4",
                            xl: "4"
                        }
                    }, [s("v-hover", {
                        scopedSlots: t._u([{
                            key: "default",
                            fn: function(a) {
                                var i = a.hover;
                                return [s("v-card", {
                                    staticClass: "card",
                                    class: {
                                        up: i
                                    },
                                    attrs: {
                                        shaped: "",
                                        elevation: i ? 10 : 4
                                    }
                                }, [s("v-img", {
                                    staticClass: "d-block ml-auto mr-auto",
                                    class: {
                                        "zoom-efect": i
                                    },
                                    attrs: {
                                        eager: !0,
                                        src: e.img,
                                        "max-width": "100px"
                                    }
                                }), s("h1", {
                                    staticClass: "font-weight-regular"
                                }, [t._v(" " + t._s(e.title) + " "), s("v-chip", {
                                    staticClass: "ma-2",
                                    attrs: {
                                        color: "red",
                                        "text-color": "white"
                                    }
                                }, [t._v(" " + t._s(e.titleChips) + " ")])], 1), s("h4", {
                                    staticClass: "font-weight-regular subtitle-1"
                                }, [t._v(" " + t._s(e.subtitle) + " ")]), s("p", {
                                    staticClass: "text-left description"
                                }, [t._v(" " + t._s(e.description) + " ")]), s("v-list", {
                                    staticClass: "text-left enable-options",
                                    attrs: {
                                        dense: ""
                                    }
                                }, [s("v-list-item-group", {
                                    attrs: {
                                        color: "primary"
                                    }
                                }, [s("v-list-item", {
                                    on: {
                                        click: function(e) {
                                            return t.$vuetify.goTo("#dialog")
                                        }
                                    }
                                }, [s("v-list-item-icon", [s("v-icon", {
                                    attrs: {
                                        color: "#283e79"
                                    }
                                }, [t._v("mdi-checkbox-marked-circle")])], 1), s("v-list-item-content", [s("v-list-item-title", [t._v("Консультация по налоговым вычетам")])], 1)], 1), t._l(e.enabledOption, (function(e, a) {
                                    return s("v-list-item", {
                                        key: a
                                    }, [s("v-list-item-icon", [s("v-icon", {
                                        attrs: {
                                            color: "#283e79"
                                        }
                                    }, [t._v("mdi-checkbox-marked-circle")])], 1), s("v-list-item-content", [s("v-list-item-title", {
                                        domProps: {
                                            textContent: t._s(e)
                                        }
                                    })], 1)], 1)
                                }))], 2)], 1), s("v-list", {
                                    staticClass: "text-left disable-options",
                                    attrs: {
                                        dense: ""
                                    }
                                }, [s("v-list-item-group", {
                                    attrs: {
                                        color: "primary"
                                    }
                                }, t._l(e.disableOption, (function(e, a) {
                                    return s("v-list-item", {
                                        key: a
                                    }, [s("v-list-item-icon", [s("v-icon", [t._v("mdi-minus-circle")])], 1), s("v-list-item-content", [s("v-list-item-title", {
                                        domProps: {
                                            textContent: t._s(e)
                                        }
                                    })], 1)], 1)
                                })), 1)], 1), s("v-divider"), s("p", {
                                    staticClass: "pa-4 price-text"
                                }, [t._v(t._s(e.priceText))]), s("p", [s("span", {
                                    staticClass: "price"
                                }, [t._v(t._s(e.price))]), t._v(" "), s("span", {
                                    staticClass: "price-crossed text-decoration-line-through"
                                }, [t._v(t._s(e.crossedPrice))]), s("v-btn", {
                                    staticClass: "call-btn-3 v-btn",
                                    on: {
                                        click: function(s) {
                                            return t.selectPrice(e.rate)
                                        }
                                    }
                                }, [t._v("Заказать")])], 1)], 1)]
                            }
                        }], null, !0)
                    })], 1)
                })), 1)], 1)], 1)], 1)], 1)], 1)], 1)
            },
            ct = [],
            lt = {
                data: function() {
                    return {
                        prices: [{
                            img: s("7a41"),
                            title: "Базовый",
                            titleChips: "-10%",
                            subtitle: "Получите готовую декларацию 3-НДФЛ. Срок — до 3 рабочих дней.",
                            description: "Для опытных налогоплательщиков",
                            enabledOption: ["Гарантия качества услуг", "Декларация 3-НДФЛ", "Заявление на возврат налога"],
                            disableOption: ["Иные документы в зависимости от вашей ситуации", "Подача документов в налоговую инспекцию"],
                            price: "990 ₽",
                            priceValue: "990",
                            crossedPrice: "1100 ₽",
                            rate: "Базовый (990 ₽)"
                        }, {
                            img: s("7a41"),
                            title: "Оптимальный",
                            titleChips: "-10%",
                            subtitle: "Самый популярный выбор. Срок — до 2 рабочих дней.",
                            description: "Декларация, заявление и консультация по подаче",
                            enabledOption: ["Гарантия качества услуг", "Декларация 3-НДФЛ", "Заявление на возврат налога", "Консультация по подаче в ФНС"],
                            disableOption: ["Иные документы в зависимости от вашей ситуации", "Подача документов в налоговую инспекцию"],
                            price: "1 210 ₽",
                            priceValue: "1210",
                            crossedPrice: "1 340 ₽",
                            rate: "Оптимальный (1 210 ₽)"
                        }, {
                            img: s("1f1e"),
                            title: "Премиум",
                            titleChips: "-10%",
                            subtitle: "Мы сделаем все за вас. Срок — 1 рабочий день.",
                            description: "Подготовим и подадим документы в налоговую",
                            enabledOption: ["Гарантия качества услуг", "Декларация 3-НДФЛ", "Заявление на возврат налога", "Иные документы в зависимости от вашей ситуации", "Подача документов в налоговую инспекцию"],
                            disableOption: [],
                            price: "1 540 ₽",
                            priceValue: "1540",
                            crossedPrice: "1 940 ₽",
                            rate: "Премиум (1 540 ₽)"
                        }]
                    }
                },
                methods: {
                    selectPrice: function(t) {
                        this.$root.$emit("set-request-rate", t), this.$vuetify.goTo("#request")
                    }
                }
            },
            ft = lt,
            ut = (s("1f5a"), s("cc20")),
            dt = s("a523"),
            pt = s("ce87"),
            mt = s("1baa"),
            vt = Object(d["a"])(ft, ot, ct, !1, null, null, null),
            ht = vt.exports;
        m()(vt, {
            VBtn: b["a"],
            VCard: S["a"],
            VChip: ut["a"],
            VCol: Y["a"],
            VContainer: dt["a"],
            VDivider: g["a"],
            VHover: pt["a"],
            VIcon: C["a"],
            VImg: H["a"],
            VList: j["a"],
            VListItem: y["a"],
            VListItemContent: w["a"],
            VListItemGroup: mt["a"],
            VListItemIcon: _["a"],
            VListItemTitle: w["b"],
            VRow: J["a"]
        });
        var bt = function() {
                var t = this,
                    e = t.$createElement,
                    s = t._self._c || e;
                return s("section", {
                    attrs: {
                        id: "section1"
                    }
                }, [s("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [s("v-col", {
                    attrs: {
                        cols: "10"
                    }
                }, [s("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [s("v-col", {
                    attrs: {
                        cols: "12",
                        md: "9",
                        xl: "9"
                    }
                }, [s("div", {
                    staticClass: "text-center mt-4"
                }, [s("h1", {
                    staticClass: "section-title font-weight-light"
                }, [t._v("Задайте вопрос эксперту напрямую")])])]), s("v-col", {
                    staticClass: "mt-6 mb-6 section1-cards",
                    staticStyle: {
                        "padding-left": "0",
                        "padding-right": "0"
                    },
                    attrs: {
                        cols: "12",
                        md: "9",
                        xl: "9"
                    }
                }, [s("v-row", t._l(t.panels, (function(e, a) {
                    return s("v-col", {
                        key: a,
                        staticClass: "expert-panel",
                        attrs: {
                            md: "4",
                            title: e.text
                        }
                    }, [s("v-hover", {
                        scopedSlots: t._u([{
                            key: "default",
                            fn: function(a) {
                                var i = a.hover;
                                return [s("a", {
                                    class: {
                                        up: i
                                    },
                                    attrs: {
                                        href: e.href
                                    }
                                }, [s("div", {
                                    staticStyle: {
                                        "background-color": "transparent",
                                        color: "red",
                                        "text-align": "center"
                                    }
                                }, [s("v-img", {
                                    staticClass: "d-block ml-auto mr-auto",
                                    class: {
                                        "zoom-efect": i
                                    },
                                    attrs: {
                                        eager: !0,
                                        src: e.img,
                                        "max-width": "200px"
                                    }
                                }), s("div", {
                                    staticClass: "text",
                                    style: e.textStyle
                                }, [t._v(" " + t._s(e.text) + " ")])], 1)])]
                            }
                        }], null, !0)
                    })], 1)
                })), 1)], 1)], 1)], 1)], 1)], 1)
            },
            gt = [],
            xt = {
                data: function() {
                    return {
                        panels: [{
                            href: "https://t.me/+79208379193",
                            img: s("a20f"),
                            text: "Написать в Telegram",
                            textStyle: "color: #095e82"
                        }, {
                            href: "https://max.ru/u/f9LHodD0cOLIp0-KV0ruUarAhMwA5f5VEg7lElOPog3Zbi9MYv4py6G3TSA",
                            img: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='32' fill='%236c5ce7'/><text x='32' y='40' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-weight='700' font-size='22' fill='%23fff'>MAX</text></svg>",
                            text: "Написать в Max",
                            textStyle: "color: #6c5ce7"
                        }]
                    }
                }
            },
            Ct = xt,
            jt = (s("3825"), Object(d["a"])(Ct, bt, gt, !1, null, null, null)),
            yt = jt.exports;
        m()(jt, {
            VCol: Y["a"],
            VHover: pt["a"],
            VImg: H["a"],
            VRow: J["a"]
        });
        var wt = function() {
                var t = this,
                    e = t.$createElement,
                    s = t._self._c || e;
                return s("section", {
                    staticClass: "pb-8 pt-10",
                    attrs: {
                        id: "situation"
                    }
                }, [s("v-container", {
                    attrs: {
                        fluid: ""
                    }
                }, [s("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [s("v-col", {
                    attrs: {
                        cols: "10"
                    }
                }, [s("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [s("v-col", {
                    attrs: {
                        cols: "12",
                        md: "9",
                        xl: "9"
                    }
                }, [s("div", {
                    staticClass: "text-center mt-4"
                }, [s("h1", {
                    staticClass: "section-title font-weight-light"
                }, [t._v("Выберите свою ситуацию")])])])], 1), s("v-row", {
                    staticClass: "mt-6",
                    attrs: {
                        align: "center",
                        justify: "space-around"
                    }
                }, [s("v-col", {
                    attrs: {
                        cols: "12",
                        md: "12",
                        xl: "12"
                    }
                }, [s("v-carousel", {
                    staticClass: "situation-carousel",
                    attrs: {
                        "hide-delimiters": ""
                    }
                }, [t._l(t.slides, (function(e, a) {
                    return [(a + 1) % t.columns === 1 || 1 === t.columns ? s("v-carousel-item", {
                        key: a
                    }, [s("v-row", {
                        staticClass: "flex-nowrap",
                        staticStyle: {
                            height: "100%"
                        }
                    }, [t._l(t.columns, (function(e, i) {
                        return [+a + i < t.slides.length ? [s("v-col", {
                            key: i,
                            staticClass: "situation-panel"
                        }, [+a + i < t.slides.length ? s("v-sheet", {
                            attrs: {
                                height: "100%",
                                elevation: "2"
                            }
                        }, [s("v-row", {
                            staticClass: "text-center",
                            attrs: {
                                align: "center",
                                justify: "center"
                            }
                        }, [s("v-col", {
                            attrs: {
                                xs: "12"
                            }
                        }, [s("v-img", {
                            staticClass: "d-block ml-auto mr-auto",
                            attrs: {
                                eager: !0,
                                src: t.slides[+a + i].img,
                                "max-width": "100px"
                            }
                        })], 1)], 1), s("v-row", {
                            staticClass: "text-center",
                            attrs: {
                                align: "center",
                                justify: "center"
                            }
                        }, [s("v-col", {
                            attrs: {
                                xs: "12"
                            }
                        }, [s("h1", {
                            staticClass: "title font-weight-regular karta"
                        }, [t._v(t._s(t.slides[+a + i].title))]), s("p", {
                            staticClass: "description d_karta",
                            domProps: {
                                innerHTML: t._s(t.slides[+a + i].description)
                            }
                        }), s("p", { staticClass: "cennik" }, [s("span", {
                            staticClass: "price"
                        }, [t._v(t._s(t.slides[+a + i].price))]), s("span", {
                            staticClass: "price-crossed text-decoration-line-through"
                        }, [t._v(" " + t._s(t.slides[+a + i].crossedPrice) + " ")])]), t.slides[+a + i].crossedPrice ? s("v-btn", {
                            staticClass: "call-btn-3",
                            on: {
                                click: function(e) {
                                    return t.selectSituation(t.slides[+a + i].title)
                                }
                            }
                        }, [t._v(t._s(t.slides[+a + i].btnText))]) : s("v-btn", {
                            staticClass: "call-btn-3",
                            on: {
                                click: function(e) {
                                    return t.$vuetify.goTo("#dialog")
                                }
                            }
                        }, [t._v(t._s(t.slides[+a + i].btnText))])], 1)], 1)], 1) : t._e()], 1)] : t._e()]
                    }))], 2)], 1) : t._e()]
                }))], 2)], 1)], 1)], 1)], 1)], 1)], 1)
            },
            _t = [],
            kt = {
                name: "situation",
                data: function() {
                    return {
                        slides: [{
                            img: s("19fb"),
                            title: "Купили квартиру или дом",
                            description: 'Вернем до <span class="bold-text">260 000 ₽</span> за покупку квартиры или строительство дома',
                            price: "990 ₽",
                            priceValue: "990",
                            crossedPrice: "1100 ₽",
                            btnText: "Заказать декларацию"
                        }, {
                            img: s("4fa1"),
                            title: "Платили за ипотеку",
                            description: 'Вернем до <span class="bold-text">390 000 ₽</span> за уплаченные проценты по ипотеке',
                            price: "990 ₽",
                            priceValue: "990",
                            crossedPrice: "1100 ₽",
                            btnText: "Заказать декларацию"
                        }, {
                            img: s("40ca"),
                            title: "Платили за лечение",
                            description: 'Вернем до <span class="bold-text">13%</span> в год от расходов на медицинские услуги за себя, супруга (-и), родителей и детей до 18 лет',
                            price: "990 ₽",
                            priceValue: "990",
                            crossedPrice: "1100 ₽",
                            btnText: "Заказать декларацию"
                        }, {
                            img: s("cfb7"),
                            title: "Платили за обучение",
                            description: 'Вернем до <span class="bold-text">15 600 ₽</span> в год за оплату своего обучения и до <span class="bold-text">6 500 ₽</span> за оплату обучения каждого ребенка до 24 лет',
                            price: "990 ₽",
                            priceValue: "990",
                            crossedPrice: "1100 ₽",
                            btnText: "Заказать декларацию"
                        }, {
                            img: s("294e"),
                            title: "Открыли инвестиционный счет",
                            description: 'Вернем до <span class="bold-text">52 000 ₽</span> в год по взносам на индивидуальный инвестиционный счет',
                            price: "990 ₽",
                            priceValue: "990",
                            crossedPrice: "1100 ₽",
                            btnText: "Заказать декларацию"
                        }, {
                            img: s("092f"),
                            title: "Платили за страхование жизни",
                            description: 'Вернем до <span class="bold-text">15 600 ₽</span> в год за оплату страхования жизни за себя, супруга (-и), родителей и детей',
                            price: "990 ₽",
                            priceValue: "990",
                            crossedPrice: "1100 ₽",
                            btnText: "Заказать декларацию"
                        }, {
                            img: s("bc40"),
                            title: "3-НДФЛ для иностранных граждан",
                            description: 'Быстро и грамотно подготовим налоговую декларацию по форме 3-НДФЛ для иностранных граждан в рамках подтверждения дохода для получения разрешения на временное проживание или гражданство',
                            price: "990 ₽",
                            priceValue: "990",
                            crossedPrice: "1100 ₽",
                            btnText: "Заказать декларацию"
                        }, {
                            img: s("1f5b"),
                            title: "Продали недвижимость или автомобиль",
                            description: 'Законно <span class="bold-text">уменьшим или освободим от уплаты  налога</span> при продаже недвижимости или автомобиля',
                            price: "990 ₽",
                            priceValue: "990",
                            crossedPrice: "1100 ₽",
                            btnText: "Заказать декларацию"
                        }, {
                            img: s("981b"),
                            title: "Иная ситуация",
                            description: "Не нашли свою ситуацию? Задайте вопрос эксперту",
                            priceValue: null,
                            price: "Бесплатно",
                            crossedPrice: null,
                            btnText: "Получить консультацию"
                        }]
                    }
                },
                computed: {
                    columns: function() {
                        return this.$vuetify.breakpoint.xl || this.$vuetify.breakpoint.lg ? 3 : this.$vuetify.breakpoint.md ? 2 : 1
                    }
                },
                methods: {
                    selectSituation: function(t) {
                        this.$root.$emit("set-request-situation", t), this.$vuetify.goTo("#request")
                    }
                }
            },
            Vt = kt,
            Et = (s("5112"), s("5e66")),
            Pt = s("3e35"),
            At = s("8dd9"),
            Tt = Object(d["a"])(Vt, wt, _t, !1, null, null, null),
            qt = Tt.exports;
        m()(Tt, {
            VBtn: b["a"],
            VCarousel: Et["a"],
            VCarouselItem: Pt["a"],
            VCol: Y["a"],
            VContainer: dt["a"],
            VImg: H["a"],
            VRow: J["a"],
            VSheet: At["a"]
        });
        var Ot = function() {
                var t = this,
                    e = t.$createElement,
                    s = t._self._c || e;
                return s("section", {
                    staticStyle: {
                        "background-color": "rgba(229,243,252,0.5)"
                    },
                    attrs: {
                        id: "section2"
                    }
                }, [s("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [s("v-col", {
                    attrs: {
                        cols: "10"
                    }
                }, [s("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [s("v-col", {
                    attrs: {
                        cols: "12",
                        md: "9",
                        xl: "9"
                    }
                }, [s("div", {
                    staticClass: "text-center mt-4"
                }, [s("h1", {
                    staticClass: "section-title font-weight-light"
                }, [t._v("Наши преимущества")])])]), s("v-col", {
                    staticClass: "mt-6 mb-6",
                    staticStyle: {
                        "padding-left": "0",
                        "padding-right": "0"
                    },
                    attrs: {
                        cols: "12",
                        md: "9",
                        xl: "9"
                    }
                }, [s("v-row", t._l(t.panels, (function(e, a) {
                    return s("v-col", {
                        key: a,
                        attrs: {
                            md: "3",
                            title: e.text
                        }
                    }, [s("v-img", {
                        staticClass: "d-block ml-auto mr-auto",
                        attrs: {
                            eager: !0,
                            src: e.img,
                            "max-width": "100px"
                        }
                    }), s("p", {
                        staticClass: "title",
                        domProps: {
                            innerHTML: t._s(e.title)
                        }
                    }), s("p", {
                        staticClass: "text"
                    }, [t._v(" " + t._s(e.text) + " ")])], 1)
                })), 1)], 1)], 1)], 1)], 1)], 1)
            },
            $t = [],
            St = {
                data: function() {
                    return {
                        panels: [{
                            href: "",
                            img: s("30f8"),
                            title: "Гарантия качества",
                            text: "В случае отказа Налоговой мы бесплатно скорректируем документы или вернем вам деньги"
                        }, {
                            href: "",
                            img: s("9629"),
                            title: "Оплата по факту",
                            text: "Мы берем оплату только по факту готовности документов."
                        }, {
                            href: "",
                            img: s("dbef"),
                            title: "Полное <br> сопровождение",
                            text: "В случае возникновения сложных ситуаций консультант помогает отстаивать законные интересы."
                        }, {
                            href: "",
                            img: s("b0c9"),
                            title: "Конфиденциальность<br> и безопасность",
                            text: "Доступ к вашим данным и финансовой информации есть только у вашего консультанта."
                        }]
                    }
                }
            },
            It = St,
            Rt = (s("b55e"), Object(d["a"])(It, Ot, $t, !1, null, null, null)),
            Bt = Rt.exports;
        m()(Rt, {
            VCol: Y["a"],
            VImg: H["a"],
            VRow: J["a"]
        });
        var Lt = function() {
                var t = this,
                    e = t.$createElement,
                    s = t._self._c || e;
                return s("section", {
                    staticClass: "pt-10",
                    attrs: {
                        id: "comment"
                    }
                }, [s("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [s("v-col", {
                    attrs: {
                        cols: "10"
                    }
                }, [s("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [s("v-col", {
                    attrs: {
                        cols: "12",
                        md: "9",
                        xl: "9"
                    }
                }, [s("div", {
                    staticClass: "text-center mt-4"
                }, [s("h1", {
                    staticClass: "section-title font-weight-light"
                }, [t._v("Отзывы")]), s("h4", {
                    staticClass: "section-subtitle font-weight-light"
                }, [t._v("Что наши клиенты говорят о нас")])])]), s("v-col", {
                    staticClass: "mt-6 mb-6 section1-cards",
                    staticStyle: {
                        "padding-left": "0",
                        "padding-right": "0"
                    },
                    attrs: {
                        cols: "12",
                        md: "9",
                        xl: "9"
                    }
                }, [s("v-row", t._l(t.feedbacks, (function(e, a) {
                    return s("v-col", {
                        key: a,
                        attrs: {
                            md: "4",
                            sm: "6",
                            xs: "12",
                            xl: "4"
                        }
                    }, [s("v-card", {
                        staticClass: "elevation-4 mx-auto",
                        attrs: {
                            width: "100%"
                        }
                    }, [s("v-card-title", {
                        staticClass: "headline justify-center"
                    }, [s("v-img", {
                        attrs: {
                            eager: !0,
                            src: e.img,
                            "max-width": "100px"
                        }
                    })], 1), s("v-card-text", [s("span", {
                        staticClass: "font-weight-bold",
                        staticStyle: {
                            color: "#005096"
                        }
                    }, [t._v(t._s(e.fio))]), s("br"), s("span", {
                        staticClass: "font-weight-bold"
                    }), s("v-divider", {
                        staticClass: "pa-2"
                    }), t._v(" " + t._s(e.text) + " ")], 1), s("v-divider"), s("div", {
                        staticClass: "text-center mt-2 mb-5"
                    }, [s("v-rating", {
                        attrs: {
                            value: 5,
                            color: "#005096",
                            "background-color": "grey darken-1",
                            "empty-icon": "$ratingFull",
                            hover: ""
                        }
                    })], 1)], 1)], 1)
                })), 1)], 1)], 1)], 1)], 1)], 1)
            },
            zt = [],
            Nt = {
                data: function() {
                    return {
                        feedbacks: [{
                            img: s("30a4"),
                            fio: "Анастасия Максимова",
                            date: "08 июня 2021",
                            text: "Хочу поблагодарить консультанта Анастасию Лапенко за активный и продуктивный подход! Без Вашей помощи, я бы не разобралась. Спасибо Вам за то, что Вы не только помогли мне решить вопрос, но и предложили несколько вариантов, позволяющих получить максимальный вычет. Спасибо Большое!"
                        }, {
                            img: s("03f9"),
                            fio: "Екатерина Иванова",
                            date: "10 июня 2021",
                            text: "Спасибо за проделанную работу. Все качественно и оперативно. Не ожидала, что такой объем работы возможно выполнить в такие сжатые сроки. Планирую в следующем году покупку квартиры на мужа, вернемся к вам за вычетом обязательно."
                        }, {
                            img: s("c0b3"),
                            fio: "Артем Тулеев",
                            date: "05 июня 2021",
                            text: "Получили все документы в обозначенные сроки, спасибо за быстрое реагирование и помощь с составлением декларации. Особенная благодарность менеджеру-консультанту Сергею Распертову, без вас я бы не справился. Спасибо."
                        }, {
                            img: s("a210"),
                            fio: "Ольга Седакова",
                            date: "09 июня 2021",
                            text: "Долго не могла решиться заказать декларацию, пыталась оформить ее самостоятельно. Но оказалось, что это целый космос, нужно лет 300 разбираться в деталях налогового учета. Поэтому решила поискать помощников и нашла Налог Сервис. Ребята сделали все на уровне за более чем приемлемые деньги в более чем приемлемые сроки. Спасибо вам!"
                        }, {
                            img: s("aa33"),
                            fio: "Данила Ткаченко",
                            date: "02 июля 2021",
                            text: "Сервис – высший класс. Все сделали качественно и быстро. В Налоговой документы приняли сразу, без вопросов. Вычет вернули раньше, чем я ожидал. "
                        }, {
                            img: s("307c"),
                            fio: "Марина Сырникова",
                            date: "22 августа 2021",
                            text: "Спасибо команде Налог Сервиса за клиентоориентированный подход. Мне все очень понравилось, особенно общение с терпеливым и понимающим консультантом (к сожалению, не помню вашего имени). Я оплатила лечение и обратилась в Налог Сервис за помощью в возврате расходов на медицинские услуги и не пожалела ни минуты."
                        }]
                    }
                }
            },
            Dt = Nt,
            Mt = s("1d4d"),
            Yt = Object(d["a"])(Dt, Lt, zt, !1, null, null, null),
            Ht = Yt.exports;
        m()(Yt, {
            VCard: S["a"],
            VCardText: I["a"],
            VCardTitle: I["b"],
            VCol: Y["a"],
            VDivider: g["a"],
            VImg: H["a"],
            VRating: Mt["a"],
            VRow: J["a"]
        });
        var Wt = function() {
                var t = this,
                    e = t.$createElement,
                    s = t._self._c || e;
                return s("section", {
                    attrs: {
                        id: "section1"
                    }
                }, [s("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [s("v-col", {
                    attrs: {
                        cols: "10"
                    }
                }, [s("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [s("v-col", {
                    attrs: {
                        cols: "12",
                        md: "9",
                        xl: "9"
                    }
                }, [s("div", {
                    staticClass: "text-center mt-4"
                }, [s("h1", {
                    staticClass: "section-title font-weight-light"
                }, [t._v("Наша команда экспертов")]), s("h4", {
                    staticClass: "section-subtitle font-weight-light"
                }, [t._v("Доверьте подготовку ваших документов нашим экспертам")])])]), s("v-col", {
                    staticClass: "mb-6 section1-cards",
                    staticStyle: {
                        "padding-left": "0",
                        "padding-right": "0"
                    },
                    attrs: {
                        cols: "12",
                        md: "9",
                        xl: "9"
                    }
                }, [s("div", {
                    staticClass: "row align-center justify-center"
                }, t._l(t.experts, (function(e, a) {
                    return s("div", {
                        key: a,
                        staticClass: "d-flex flex-column align-center justify-center col-sm-6 col-md-6 col-lg-2 col-xl-2 col-12"
                    }, [s("v-img", {
                        staticClass: "d-block ml-auto mr-auto",
                        attrs: {
                            eager: !0,
                            src: e.img,
                            "max-width": "200px"
                        }
                    }), s("h4", {
                        staticClass: "font-weight-light   my-3 text-center fio-text"
                    }, [t._v(" " + t._s(e.fio) + " ")]), s("p", {
                        staticClass: "text-center position-text"
                    }, [t._v(t._s(e.position))]), s("p", {
                        staticClass: "text-center work-text"
                    }, [t._v(t._s(e.work))])], 1)
                })), 0)])], 1)], 1)], 1)], 1)
            },
            Jt = [],
            Gt = {
                data: function() {
                    return {
                        experts: [{
                            href: "",
                            img: s("0e97"),
                            fio: "Луиза Вакурова",
                            position: "Эксперт",
                            work: "Опыт работы: 4 лет"
                        }, {
                            href: "",
                            img: s("d94c"),
                            fio: "Виктория Миронова",
                            position: "Руководитель клиентского сервиса",
                            work: "Опыт работы: 8 лет"
                        }, {
                            href: "",
                            img: s("dd0c"),
                            fio: "Наталья Левина",
                            position: "Эксперт",
                            work: "Опыт работы: 5 лет"
                        }, {
                            href: "",
                            img: s("6f123"),
                            fio: "Кристина Артёмова",
                            position: "Эксперт",
                            work: "Опыт работы: 6 лет"
                        }, {
                            href: "",
                            img: s("54c1"),
                            fio: "Ирина Белова",
                            position: "Эксперт",
                            work: "Опыт работы: 7 лет"
                        }]
                    }
                }
            },
            Zt = Gt,
            Qt = (s("a575"), Object(d["a"])(Zt, Wt, Jt, !1, null, null, null)),
            Xt = Qt.exports;
        m()(Qt, {
            VCol: Y["a"],
            VImg: H["a"],
            VRow: J["a"]
        });
        var Ft = function() {
                var t = this,
                    e = t.$createElement,
                    s = t._self._c || e;
                return s("section", {
                    staticClass: "pt-10",
                    staticStyle: {
                        "background-color": "rgba(229,243,252,0.5)"
                    },
                    attrs: {
                        id: "request"
                    }
                }, [s("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [s("v-col", {
                    attrs: {
                        cols: "10"
                    }
                }, [s("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [s("v-col", {
                    attrs: {
                        cols: "12",
                        md: "9",
                        xl: "9"
                    }
                }, [s("div", {
                    staticClass: "text-center mt-4"
                }, [s("h1", {
                    staticClass: "section-title font-weight-light"
                }, [t._v("Заказать услугу")]), t.rateDescription ? s("h4", {
                    staticClass: "section-subtitle font-weight-light"
                }, [t._v(t._s(t.rateDescription))]) : t._e()])]), s("v-col", {
                    staticClass: "mb-6 section1-cards",
                    staticStyle: {
                        "padding-left": "0",
                        "padding-right": "0"
                    },
                    attrs: {
                        cols: "12",
                        md: "9",
                        xl: "9"
                    }
                }, [s("v-row", [s("v-col", {
                    attrs: {
                        cols: "12",
                        "offset-md": "3",
                        md: "6",
                        xs: "12"
                    }
                }, [s("v-form", {
                    ref: "form",
                    staticClass: "pa-4",
                    on: {
                        submit: function(e) {
                            return e.preventDefault(), t.handleSubmit.apply(null, arguments)
                        }
                    }
                }, [s("v-select", {
                    attrs: {
                        items: t.situationItems,
                        label: "Ситуация",
                        "error-messages": t.situationErrors
                    },
                    on: {
                        input: function(e) {
                            return t.$v.form.situation.$touch()
                        },
                        blur: function(e) {
                            return t.$v.form.situation.$touch()
                        }
                    },
                    model: {
                        value: t.form.situation,
                        callback: function(e) {
                            t.$set(t.form, "situation", e)
                        },
                        expression: "form.situation"
                    }
                }), s("v-text-field", {
                    attrs: {
                        name: "fio",
                        label: "Ваше Имя",
                        "error-messages": t.fioErrors
                    },
                    on: {
                        input: function(e) {
                            return t.$v.form.fio.$touch()
                        },
                        blur: function(e) {
                            return t.$v.form.fio.$touch()
                        }
                    },
                    model: {
                        value: t.form.fio,
                        callback: function(e) {
                            t.$set(t.form, "fio", e)
                        },
                        expression: "form.fio"
                    }
                }), s("v-text-field", {
                    attrs: {
                        name: "phone",
                        label: "Телефон",
                        "error-messages": t.phoneErrors
                    },
                    on: {
                        input: function(e) {
                            return t.$v.form.phone.$touch()
                        },
                        blur: function(e) {
                            return t.$v.form.phone.$touch()
                        }
                    },
                    model: {
                        value: t.form.phone,
                        callback: function(e) {
                            t.$set(t.form, "phone", e)
                        },
                        expression: "form.phone"
                    }
                }), s("v-checkbox", {
                    staticClass: "offer-checkbox",
                    attrs: {
                        name: "offer"
                    },
                    on: {
                        click: this.$v.$touch
                    },
                    scopedSlots: t._u([{
                        key: "label",
                        fn: function() {
                            return [s("div", [t._v(" Принимаю условия "), s("a", {
                                attrs: {
                                    href: "/offer.html"
                                },
                                on: {
                                    click: function(t) {
                                        t.stopPropagation()
                                    }
                                }
                            }, [t._v("Публичной оферты")]), t._v(" и "), s("a", {
                                attrs: {
                                    href: "/policy.html"
                                },
                                on: {
                                    click: function(t) {
                                        t.stopPropagation()
                                    }
                                }
                            }, [t._v("Политикой конфиденциальности")]), t._v(", даю согласие на обработку персональных данных. ")])]
                        },
                        proxy: !0
                    }]),
                    model: {
                        value: t.form.offer,
                        callback: function(e) {
                            t.$set(t.form, "offer", e)
                        },
                        expression: "form.offer"
                    }
                }), s("v-btn", {
                    staticClass: "mr-4 white--text",
                    attrs: {
                        disabled: !t.form.offer,
                        block: "",
                        tile: "",
                        color: "#c42234",
                        type: "submit"
                    }
                }, [t._v(" Заказать ")])], 1)], 1)], 1)], 1)], 1)], 1)], 1)], 1)
            },
            Kt = [],
            Ut = s("1da1"),
            te = (s("96cf"), s("99af"), s("4795"), function() {
                var t = this,
                    e = t.$createElement,
                    s = t._self._c || e;
                return s("form", {
                    staticClass: "yoomoney-payment-form",
                    attrs: {
                        action: "https://yookassa.ru/integration/simplepay/payment",
                        method: "post",
                        "accept-charset": "utf-8"
                    }
                }, [t.email ? s("input", {
                    attrs: {
                        name: "cps_email",
                        placeholder: "Email",
                        type: "hidden"
                    },
                    domProps: {
                        value: t.email
                    }
                }) : t._e(), t.phone ? s("input", {
                    attrs: {
                        name: "cps_phone",
                        placeholder: "Телефон",
                        type: "hidden"
                    },
                    domProps: {
                        value: t.phone
                    }
                }) : t._e(), t.fio ? s("input", {
                    attrs: {
                        name: "custName",
                        placeholder: "ФИО",
                        type: "hidden"
                    },
                    domProps: {
                        value: t.fio
                    }
                }) : t._e(), t.comment ? s("input", {
                    attrs: {
                        name: "orderDetails",
                        placeholder: "Комментарий",
                        type: "hidden"
                    },
                    domProps: {
                        value: t.comment
                    }
                }) : t._e(), t.info ? s("input", {
                    attrs: {
                        name: "customerNumber",
                        type: "hidden"
                    },
                    domProps: {
                        value: t.info
                    }
                }) : t._e(), s("div", {
                    staticClass: "ym-payment-btn-block"
                }, [s("div", {
                    staticClass: "ym-input-icon-rub ym-display-none"
                }, [s("input", {
                    staticClass: "ym-input ym-sum-input ym-required-input",
                    attrs: {
                        name: "sum",
                        placeholder: "0.00",
                        type: "hidden",
                        step: "any"
                    },
                    domProps: {
                        value: t.price
                    }
                })]), s("v-btn", {
                    staticClass: "v-btn call-btn-3 ym-btn-pay ym-result-price",
                    attrs: {
                        type: "submit",
                        block: "",
                        disabled: t.disabled,
                        "data-text": t.btnText
                    }
                }, [s("span", {
                    staticClass: "ym-text-crop"
                }, [t._v(t._s(t.btnText))])])], 1), s("input", {
                    attrs: {
                        name: "shopId",
                        type: "hidden",
                        value: "836525"
                    }
                })])
            }),
            ee = [],
            se = {
                name: "ycassa",
                props: ["btnText", "disabled", "price", "email", "phone", "fio", "comment", "info"],
                data: function() {
                    return {}
                }
            },
            ae = se,
            ie = (s("2d61"), Object(d["a"])(ae, te, ee, !1, null, null, null)),
            re = ie.exports;
        m()(ie, {
            VBtn: b["a"]
        });
        var ne = s("b5ae"),
            oe = s("b383"),
            ce = {
                components: {
                    ycassaBtn: re
                },
                data: function() {
                    return {
                        rateItems: ["Премиум (1 540 ₽)", "Оптимальный (1 210 ₽)", "Базовый (990 ₽)"],
                        situationItems: ["Платили за ипотеку", "Купили квартиру или дом", "Платили за лечение", "Платили за обучение", "Открыли инвестиционный счет", "Платили за страхование жизни", "Продали недвижимость", "Продали автомобиль", "Иная ситуация"],
                        form: {
                            situation: "Платили за ипотеку",
                            type: "request",
                            fio: "",
                            email: "",
                            phone: "",
                            comment: "",
                            offer: !1
                        }
                    }
                },
                validations: {
                    form: {
                        situation: {
                            required: ne["required"]
                        },
                        fio: {
                            required: ne["required"]
                        },
                        phone: {
                            required: ne["required"]
                        },
                        comment: {},
                        offer: {
                            required: ne["required"]
                        }
                    }
                },
                computed: {
                    rateInfo: function() {
                        return "Ситуация: ".concat(this.form.situation, ". ФИО: ").concat(this.form.fio, ". Email: ").concat(this.form.email || "---", ". Телефон: ").concat(this.form.phone, ". Комментарии: ").concat(this.form.comment || "---", ".")
                    },
                    ratePrice: function() {
                        switch (this.form.rate) {
                            case "Премиум (1 540 ₽)":
                                return "1540";
                            case "Оптимальный (1 210 ₽)":
                                return "1210";
                            case "Базовый (990 ₽)":
                                return "990";
                            default:
                                return !1
                        }
                    },
                    rateDescription: function() {
                        switch (this.form.rate) {
                            case "Премиум (1 540 ₽)":
                                return "Готовим для Вас декларацию 3-НДФЛ и заявление на возврат налога, а также иные документы в зависимости от Вашей ситуации. Самостоятельно направляем документы в налоговую.";
                            case "Оптимальный (1 210 ₽)":
                                return "Готовим для Вас декларацию 3-НДФЛ и заявление на возврат налога, консультируем по подаче в налоговую";
                            case "Базовый (990 ₽)":
                                return "Готовим для Вас декларацию 3-НДФЛ и заявление на возврат налога";
                            default:
                                return null
                        }
                    },
                    situationErrors: function() {
                        var t = [];
                        return this.$v.form.situation.$dirty ? (!this.$v.form.situation.required && t.push("Обязательное поле."), t) : t
                    },
                    fioErrors: function() {
                        var t = [];
                        return this.$v.form.fio.$dirty ? (!this.$v.form.fio.required && t.push("Обязательное поле."), t) : t
                    },
                    phoneErrors: function() {
                        var t = [];
                        return this.$v.form.phone.$dirty ? (!this.$v.form.phone.required && t.push("Обязательное поле."), t) : t
                    },
                    commentErrors: function() {
                        var t = [];
                        return this.$v.form.comment.$dirty, t
                    },
                    offerErrors: function() {
                        var t = [];
                        return this.$v.form.offer.$dirty ? (!this.$v.form.offer.required && t.push("Обязательное поле."), t) : t
                    }
                },
                mounted: function() {
                    this.$root.$on("set-request-situation", this.setRequestSituation)
                },
                destroyed: function() {
                    this.$root.$off("set-request-situation", this.setRequestSituation)
                },
                methods: {
                    setRequestSituation: function(t) {
                        this.form.situation = t
                    },
                    handleSubmit: function() {
                        var t = this;
                        return Object(Ut["a"])(regeneratorRuntime.mark((function e() {
                            return regeneratorRuntime.wrap((function(e) {
                                while (1) switch (e.prev = e.next) {
                                    case 0:
                                        if (t.$v.$touch(), !t.$v.$invalid) {
                                            e.next = 3;
                                            break
                                        }
                                        return e.abrupt("return");
                                    case 3:
                                        return e.prev = 3, e.next = 6, t.$ajax.post("/email.php", oe.stringify(t.form));
                                    case 6:
                                        t.$root.$emit("show-info", "Спасибо за вашу заявку. Специалист свяжется с вами в ближайшее время"), t.$refs.form.reset(), setTimeout((function() {
                                            t.$v.$reset()
                                        }), 0), e.next = 13;
                                        break;
                                    case 11:
                                        e.prev = 11, e.t0 = e["catch"](3);
                                    case 13:
                                    case "end":
                                        return e.stop()
                                }
                            }), e, null, [
                                [3, 11]
                            ])
                        })))()
                    }
                }
            },
            le = ce,
            fe = (s("b9d1"), s("ac7c")),
            ue = s("4bd4"),
            de = s("b974"),
            pe = s("8654"),
            me = s("a844"),
            ve = Object(d["a"])(le, Ft, Kt, !1, null, null, null),
            he = ve.exports;
        m()(ve, {
            VBtn: b["a"],
            VCheckbox: fe["a"],
            VCol: Y["a"],
            VForm: ue["a"],
            VRow: J["a"],
            VSelect: de["a"],
            VTextField: pe["a"],
            VTextarea: me["a"]
        });
        var be = function() {
                var t = this,
                    e = t.$createElement,
                    a = t._self._c || e;
                return a("section", {
                    staticClass: "pt-10",
                    attrs: {
                        id: "contact"
                    }
                }, [a("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [a("v-col", {
                    attrs: {
                        cols: "10"
                    }
                }, [a("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [a("v-col", {
                    attrs: {
                        cols: "12",
                        md: "9",
                        xl: "9"
                    }
                }, [a("div", {
                    staticClass: "text-center mt-4"
                }, [a("h1", {
                    staticClass: "section-title font-weight-light"
                }, [t._v("Наши контакты")]), a("h4", {
                    staticClass: "section-subtitle font-weight-light"
                }, [t._v("Онлайн-сервис Налог-сервис – профессиональная помощь по заполнению декларации 3-НДФЛ и оформлению налогового вычета.")])])]), a("v-col", {
                    staticClass: "mt-6 mb-6 contact-card",
                    staticStyle: {
                        "padding-left": "0",
                        "padding-right": "0"
                    },
                    attrs: {
                        cols: "12",
                        md: "9",
                        xl: "9"
                    }
                }, [a("v-row", [a("v-col", {
                    attrs: {
                        md: "6",
                        sm: "6",
                        xs: "12"
                    }
                }, [a("p", [a("span", {
                    staticClass: "title"
                }, [t._v('ООО "ИНФОРМКАРТ"')]), t._v(" "), a("span", {
                    staticClass: "value"
                })]), a("p", [a("span", {
                    staticClass: "title"
                }, [t._v("ИНН:")]), t._v(" "), a("span", {
                    staticClass: "value"
                }, [t._v("7420010847")])]), a("p", [a("span", {
                    staticClass: "title"
                }, [t._v("ОГРН:")]), t._v(" "), a("span", {
                    staticClass: "value"
                }, [t._v("1067420016168")])]), a("p", [a("span", {
                    staticClass: "title"
                }, [t._v("СЧЁТ:")]), t._v(" "), a("span", {
                    staticClass: "value"
                }, [t._v("40702810007710002545")])]), a("p", [a("span", {
                    staticClass: "title"
                }, [t._v("БАНК:")]), t._v(" "), a("span", {
                    staticClass: "value"
                }, [t._v("В ПАО «Челиндбанк»")])]), a("p", [a("span", {
                    staticClass: "title"
                }, [t._v("БИК:")]), t._v(" "), a("span", {
                    staticClass: "value"
                }, [t._v("047501711")])])]), a("v-col", {
                    attrs: {
                        md: "6",
                        sm: "6",
                        xs: "12"
                    }
                }, [a("p", [a("span", {
                    staticClass: "title"
                }, [a("v-icon", [t._v("mdi-phone")]), t._v("Колл-центр 24/7:")], 1), a("br"), a("span", {
                    staticClass: "value"
                }, [a("a", {
                    attrs: {
                        href: "tel:+79208379193"
                    }
                }, [t._v("+7 (920) 837-91-93")])])]), a("p", [a("span", {
                    staticClass: "title"
                }, [a("v-icon", [t._v("mdi-message-reply-text-outline")]), t._v(" Мессенджеры:")], 1)]), a("div", [a("a", {
                    staticClass: "d-inline-block pa-2",
                    attrs: {
                        href: "https://t.me/+79208379193"
                    }
                }, [a("v-img", {
                    attrs: {
                        src: s("1791"),
                        width: "50px",
                        title: "Написать в Telegram"
                    }
                })], 1), a("a", {
                    staticClass: "d-inline-block pa-2",
                    attrs: {
                        href: "https://max.ru/u/f9LHodD0cOLIp0-KV0ruUarAhMwA5f5VEg7lElOPog3Zbi9MYv4py6G3TSA",
                        target: "_blank"
                    }
                }, [a("v-img", {
                    attrs: {
                        src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='32' fill='%236c5ce7'/><text x='32' y='40' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-weight='700' font-size='22' fill='%23fff'>MAX</text></svg>",
                        width: "50px",
                        title: "Написать в Max"
                    }
                })], 1)]), a("p"), a("p", [a("span", {
                    staticClass: "title"
                }, [a("v-icon", [t._v("mdi-email-outline")]), t._v("По всем вопросам:")], 1), a("br"), a("span", {
                    staticClass: "value"
                }, [a("a", {
                    attrs: {
                        href: "mailto:NALOG-SERVICE@INTERNET.RU"
                    }
                }, [t._v("NALOG-SERVICE@INTERNET.RU")])])])])], 1)], 1)], 1)], 1)], 1)], 1)
            },
            ge = [],
            xe = {
                data: function() {
                    return {}
                }
            },
            Ce = xe,
            je = (s("4d31"), Object(d["a"])(Ce, be, ge, !1, null, null, null)),
            ye = je.exports;
        m()(je, {
            VCol: Y["a"],
            VIcon: C["a"],
            VImg: H["a"],
            VRow: J["a"]
        });
        var we = function() {
                var t = this,
                    e = t.$createElement,
                    s = t._self._c || e;
                return s("section", {
                    attrs: {
                        id: "section8"
                    }
                }, [s("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [s("v-col", {
                    attrs: {
                        cols: "10"
                    }
                }, [s("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [s("v-col", {
                    attrs: {
                        cols: "12",
                        md: "9",
                        xl: "9"
                    }
                }, [s("div", {
                    staticClass: "text-center mt-4"
                }, [s("h1", {
                    staticClass: "section-title font-weight-light"
                }, [t._v("Часто задаваемые вопросы")])])]), s("v-col", {
                    staticClass: "mt-6 mb-6 section1-cards",
                    staticStyle: {
                        "padding-left": "0",
                        "padding-right": "0"
                    },
                    attrs: {
                        cols: "12",
                        md: "9",
                        xl: "9"
                    }
                }, [s("v-row", [s("v-col", {
                    attrs: {
                        cols: "12",
                        md: "12",
                        "offset-lg": "2",
                        lg: "8",
                        xs: "12"
                    }
                }, [s("v-expansion-panels", {
                    attrs: {
                        accordion: ""
                    }
                }, t._l(t.items, (function(e, a) {
                    return s("v-expansion-panel", {
                        key: a
                    }, [s("v-expansion-panel-header", [t._v(t._s(e.title))]), s("v-expansion-panel-content", [s("p", {
                        domProps: {
                            innerHTML: t._s(e.text)
                        }
                    })])], 1)
                })), 1)], 1)], 1)], 1)], 1)], 1)], 1)], 1)
            },
            _e = [],
            ke = {
                data: function() {
                    return {
                        items: [{
                            title: "Как передать документы для подготовки?",
                            text: 'Вы можете отправить фотографии или скан-копию документов любым удобным способом: <a href="mailto:NALOG-SERVICE@INTERNET.RU" target="_blank">электронная почта</a>, мессенджеры (<a href="https://t.me/+79208379193" target="_blank">Telegram</a> и <a href="https://max.ru/u/f9LHodD0cOLIp0-KV0ruUarAhMwA5f5VEg7lElOPog3Zbi9MYv4py6G3TSA" target="_blank">Max</a>).'
                        }, {
                            title: "Сколько времени занимает подготовка документов?",
                            text: "Срок подготовки документов – от 1 до 3 рабочих дней в зависимости от тарифа, с момента получения всех запрошенных документов."
                        }, {
                            title: "Как и когда оплачивать?",
                            text: "Оплата производится по факту готовности документов. Наш специалист направляет вам готовые документы и ссылку на оплату. Оплатить можно онлайн (картами МИР, Visa, Mastercard, Maestro, SberPay, Тинькофф, Альфа-клик и др.) или наличными в терминалах города, салонах Связной, любом банкомате Сбербанка."
                        }, {
                            title: "Что такое гарантия качества услуг?",
                            text: "В случае возвращения документов Налоговой службой с замечаниями мы бесплатно выполняем все корректировки, а в случае невозможности исправления – возвращаем деньги."
                        }, {
                            title: "Как я получу готовые документы?",
                            text: 'Готовый пакет документов отправляем вам любым удобным способом: <a href="mailto:NALOG-SERVICE@INTERNET.RU" target="_blank">электронная почта</a>,\nмессенджеры (<a href="https://t.me/+79208379193" target="_blank">Telegram</a> и <a href="https://max.ru/u/f9LHodD0cOLIp0-KV0ruUarAhMwA5f5VEg7lElOPog3Zbi9MYv4py6G3TSA" target="_blank">Max</a>). Предоставляем пошаговую инструкцию по сдаче\nдокументов в налоговую инспекцию лично, по почте, через личный кабинет налогоплательщика\nили портал Госуслуги.'
                        }, {
                            title: "Если налоговая найдет ошибку в декларации 3-НДФЛ?",
                            text: " Все подготовленные документы проходят двух этапную проверку:\n<ol>\n    <li>Проверка полноты представления документов и обоснованности заявленных налоговых\nвычетов.</li>\n    <li>Арифметический контроль подсчета данных в декларации, визуальная проверка правильности\nоформления документов – полнота и четкость заполнения всех необходимых реквизитов.</li>\n</ol>\nЕсли в ходе камеральной проверки будут выявлены ошибки, допущенные по нашей вине, мы\nбесплатно внесем исправления в подготовленные документы или вернем полную стоимость\nуслуг. "
                        }, {
                            title: "Если налоговая откажет в налоговом вычете?",
                            text: "Персональный консультант сопровождает клиента до момента завершения камеральной проверки и зачисления денежных средств на счет. В случае отказа в предоставлении налогового вычета по нашей вине, вернем полную стоимость услуг. Если, по мнению эксперта, отказ неправомерный, поможем обжаловать решение налогового органа."
                        }]
                    }
                }
            },
            Ve = ke,
            Ee = (s("b671"), s("cd55")),
            Pe = s("49e2"),
            Ae = s("c865"),
            Te = s("0393"),
            qe = Object(d["a"])(Ve, we, _e, !1, null, null, null),
            Oe = qe.exports;
        m()(qe, {
            VCol: Y["a"],
            VExpansionPanel: Ee["a"],
            VExpansionPanelContent: Pe["a"],
            VExpansionPanelHeader: Ae["a"],
            VExpansionPanels: Te["a"],
            VRow: J["a"]
        });
        var $e = function() {
                var t = this,
                    e = t.$createElement,
                    s = t._self._c || e;
                return s("section", {
                    staticClass: "pb-8 pt-10",
                    staticStyle: {
                        "background-color": "rgba(229,243,252,0.5)"
                    },
                    attrs: {
                        id: "dialog"
                    }
                }, [s("v-container", {
                    attrs: {
                        fluid: ""
                    }
                }, [s("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [s("v-col", {
                    attrs: {
                        cols: "12",
                        md: "9",
                        xl: "9"
                    }
                }, [s("div", {
                    staticClass: "text-center mt-4"
                }, [s("h1", {
                    staticClass: "section-title font-weight-light"
                }, [t._v("Получить бесплатную консультацию")])])])], 1), s("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [s("v-col", {
                    attrs: {
                        cols: "12",
                        md: "5",
                        xl: "4"
                    }
                }, [s("p", {
                    staticClass: "pt-2 text-center",
                    staticStyle: {
                        color: "#505050",
                        "font-weight": "500"
                    }
                }, [t._v("Эксперт свяжется с вами")]), s("v-form", {
                    ref: "form",
                    staticClass: "pa-4",
                    on: {
                        submit: function(e) {
                            return e.preventDefault(), t.handleSubmit.apply(null, arguments)
                        }
                    }
                }, [s("v-text-field", {
                    attrs: {
                        name: "fio",
                        label: "Введите имя",
                        "error-messages": t.fioErrors
                    },
                    on: {
                        input: function(e) {
                            return t.$v.form.fio.$touch()
                        },
                        blur: function(e) {
                            return t.$v.form.fio.$touch()
                        }
                    },
                    model: {
                        value: t.form.fio,
                        callback: function(e) {
                            t.$set(t.form, "fio", e)
                        },
                        expression: "form.fio"
                    }
                }), s("v-text-field", {
                    attrs: {
                        name: "phone",
                        label: "Введите телефон",
                        "error-messages": t.phoneErrors
                    },
                    on: {
                        input: function(e) {
                            return t.$v.form.phone.$touch()
                        },
                        blur: function(e) {
                            return t.$v.form.phone.$touch()
                        }
                    },
                    model: {
                        value: t.form.phone,
                        callback: function(e) {
                            t.$set(t.form, "phone", e)
                        },
                        expression: "form.phone"
                    }
                }), s("v-checkbox", {
                    staticClass: "offer-checkbox",
                    attrs: {
                        name: "offer"
                    },
                    scopedSlots: t._u([{
                        key: "label",
                        fn: function() {
                            return [s("div", [t._v(" Принимаю условия "), s("a", {
                                attrs: {
                                    href: "/offer.html"
                                },
                                on: {
                                    click: function(t) {
                                        t.stopPropagation()
                                    }
                                }
                            }, [t._v("Публичной оферты")]), t._v(" и "), s("a", {
                                attrs: {
                                    href: "/policy.html"
                                },
                                on: {
                                    click: function(t) {
                                        t.stopPropagation()
                                    }
                                }
                            }, [t._v("Политикой конфиденциальности")]), t._v(", даю согласие на обработку персональных данных. ")])]
                        },
                        proxy: !0
                    }]),
                    model: {
                        value: t.form.offer,
                        callback: function(e) {
                            t.$set(t.form, "offer", e)
                        },
                        expression: "form.offer"
                    }
                }), s("div", {
                    staticClass: "text-center"
                }, [s("v-btn", {
                    staticClass: "mr-4 white--text",
                    attrs: {
                        disabled: !t.form.offer,
                        block: "",
                        tile: "",
                        color: "#c42234",
                        type: "submit"
                    }
                }, [t._v(" Получить Консультацию ")])], 1)], 1)], 1)], 1)], 1)], 1)
            },
            Se = [],
            Ie = s("b383"),
            Re = {
                name: "CallDialog",
                data: function() {
                    return {
                        dialog: !1,
                        form: {
                            type: "dialog",
                            phone: "",
                            fio: "",
                            offer: !1
                        }
                    }
                },
                validations: {
                    form: {
                        phone: {
                            required: ne["required"]
                        },
                        fio: {
                            required: ne["required"]
                        },
                        offer: {
                            required: ne["required"]
                        }
                    }
                },
                computed: {
                    fioErrors: function() {
                        var t = [];
                        return this.$v.form.fio.$dirty ? (!this.$v.form.fio.required && t.push("Обязательное поле."), t) : t
                    },
                    phoneErrors: function() {
                        var t = [];
                        return this.$v.form.phone.$dirty ? (!this.$v.form.phone.required && t.push("Обязательное поле."), t) : t
                    },
                    offerErrors: function() {
                        var t = [];
                        return this.$v.form.offer.$dirty ? (!this.$v.form.offer.required && t.push("Обязательное поле."), t) : t
                    }
                },
                methods: {
                    handleSubmit: function() {
                        var t = this;
                        return Object(Ut["a"])(regeneratorRuntime.mark((function e() {
                            return regeneratorRuntime.wrap((function(e) {
                                while (1) switch (e.prev = e.next) {
                                    case 0:
                                        if (t.$v.$touch(), !t.$v.$invalid) {
                                            e.next = 3;
                                            break
                                        }
                                        return e.abrupt("return");
                                    case 3:
                                        return e.prev = 3, e.next = 6, t.$ajax.post("/email.php", Ie.stringify(t.form));
                                    case 6:
                                        t.$root.$emit("show-info", "Спасибо за вашу заявку. Специалист свяжется с вами в ближайшее время"), t.$refs.form.reset(), setTimeout((function() {
                                            t.$v.$reset()
                                        }), 0), e.next = 13;
                                        break;
                                    case 11:
                                        e.prev = 11, e.t0 = e["catch"](3);
                                    case 13:
                                    case "end":
                                        return e.stop()
                                }
                            }), e, null, [
                                [3, 11]
                            ])
                        })))()
                    }
                }
            },
            Be = Re,
            Le = (s("5471"), Object(d["a"])(Be, $e, Se, !1, null, null, null)),
            ze = Le.exports;
        m()(Le, {
            VBtn: b["a"],
            VCheckbox: fe["a"],
            VCol: Y["a"],
            VContainer: dt["a"],
            VForm: ue["a"],
            VRow: J["a"],
            VTextField: pe["a"]
        });
        var Ne = function() {
                var t = this,
                    e = t.$createElement,
                    s = t._self._c || e;
                return s("section", {
                    staticClass: "pb-8 pt-10",
                    staticStyle: {
                        "background-color": "rgba(229,243,252,0.5)"
                    },
                    attrs: {
                        id: "pricing"
                    }
                }, [s("v-container", {
                    attrs: {
                        fluid: ""
                    }
                }, [s("v-row", {
                    attrs: {
                        align: "center",
                        justify: "center"
                    }
                }, [s("v-col", {
                    attrs: {
                        cols: "12",
                        xs: "12"
                    }
                }, [s("h2", {
                    staticClass: "text-center section-title font-weight-light"
                }, [t._v("До окончания акции осталось")]), s("flip-countdown", {
                    attrs: {
                        deadline: t.deadline,
                        labels: t.deadLabel,
                        showDays: !1
                    }
                })], 1)], 1)], 1)], 1)
            },
            De = [],
            Me = s("2b64"),
            Ye = s.n(Me),
            He = s("c1df"),
            We = s.n(He),
            Je = "YYYY-MM-DD HH:mm:ss",
            Ge = {
                components: {
                    FlipCountdown: Ye.a
                },
                data: function() {
                    return {
                        prices: [{
                            img: s("7a41"),
                            title: "Базовый",
                            titleChips: "-10%",
                            subtitle: "Получите готовую декларацию 3-НДФЛ. Срок — до 3 рабочих дней.",
                            description: "Для опытных налогоплательщиков",
                            enabledOption: ["Гарантия качества услуг", "Декларация 3-НДФЛ", "Заявление на возврат налога"],
                            disableOption: ["Иные документы в зависимости от вашей ситуации", "Подача документов в налоговую инспекцию"],
                            price: "990 ₽",
                            priceValue: "990",
                            crossedPrice: "1100 ₽",
                            rate: "Базовый (990 ₽)"
                        }, {
                            img: s("7a41"),
                            title: "Оптимальный",
                            titleChips: "-10%",
                            subtitle: "Самый популярный выбор. Срок — до 2 рабочих дней.",
                            description: "Декларация, заявление и консультация по подаче",
                            enabledOption: ["Гарантия качества услуг", "Декларация 3-НДФЛ", "Заявление на возврат налога", "Консультация по подаче в ФНС"],
                            disableOption: ["Иные документы в зависимости от вашей ситуации", "Подача документов в налоговую инспекцию"],
                            price: "1 210 ₽",
                            priceValue: "1210",
                            crossedPrice: "1 340 ₽",
                            rate: "Оптимальный (1 210 ₽)"
                        }, {
                            img: s("1f1e"),
                            title: "Премиум",
                            titleChips: "-10%",
                            subtitle: "Мы сделаем все за вас. Срок — 1 рабочий день.",
                            description: "Подготовим и подадим документы в налоговую",
                            enabledOption: ["Гарантия качества услуг", "Декларация 3-НДФЛ", "Заявление на возврат налога", "Иные документы в зависимости от вашей ситуации", "Подача документов в налоговую инспекцию"],
                            disableOption: [],
                            price: "1 540 ₽",
                            priceValue: "1540",
                            crossedPrice: "1 940 ₽",
                            rate: "Премиум (1 540 ₽)"
                        }],
                        deadline: We()().add(255, "m").format(Je),
                        deadLabel: {
                            hours: "часы",
                            minutes: "минуты",
                            seconds: "секунды"
                        }
                    }
                },
                methods: {
                    selectPrice: function(t) {
                        this.$root.$emit("set-request-rate", t), this.$vuetify.goTo("#request")
                    }
                }
            },
            Ze = Ge,
            Qe = (s("aac7"), Object(d["a"])(Ze, Ne, De, !1, null, null, null)),
            Xe = Qe.exports;
        m()(Qe, {
            VCol: Y["a"],
            VContainer: dt["a"],
            VRow: J["a"]
        });
        var Fe = function() {
                var t = this,
                    e = t.$createElement,
                    s = t._self._c || e;
                return s("v-snackbar", {
                    attrs: {
                        color: "#005096",
                        "multi-line": !0,
                        timeout: t.timeout
                    },
                    model: {
                        value: t.snackbar,
                        callback: function(e) {
                            t.snackbar = e
                        },
                        expression: "snackbar"
                    }
                }, [t._v(" " + t._s(t.text) + " ")])
            },
            Ke = [],
            Ue = {
                data: function() {
                    return {
                        snackbar: !1,
                        text: null,
                        timeout: 2e3
                    }
                },
                mounted: function() {
                    this.$root.$on("show-info", this.showInfo)
                },
                destroyed: function() {
                    this.$root.$off("show-info", this.showInfo)
                },
                methods: {
                    showInfo: function(t) {
                        this.snackbar = !0, this.text = t
                    }
                }
            },
            ts = Ue,
            es = s("2db4"),
            ss = Object(d["a"])(ts, Fe, Ke, !1, null, null, null),
            as = ss.exports;
        m()(ss, {
            VSnackbar: es["a"]
        });
        var is = {
                name: "App",
                components: {
                    navigation: A,
                    foote: L,
                    home: Z,
                    order: tt,
                    sec1: nt,
                    pricing: ht,
                    expert: yt,
                    situation: qt,
                    advantages: Bt,
                    feedback: Ht,
                    expert2: Xt,
                    request: he,
                    contact: ye,
                    faq_panel: Oe,
                    call_dialog: ze,
                    info_panel: as,
                    stock: Xe
                },
                data: function() {
                    return {
                        fab: null,
                        color: "",
                        flat: null
                    }
                },
                created: function() {
                    var t = window.pageYOffset || 0;
                    t <= 60 && (this.color = "transparent", this.flat = !0)
                },
                watch: {
                    fab: function(t) {
                        t ? (this.color = "secondary", this.flat = !1) : (this.color = "transparent", this.flat = !0)
                    }
                },
                methods: {
                    onScroll: function(t) {
                        if ("undefined" !== typeof window) {
                            var e = window.pageYOffset || t.target.scrollTop || 0;
                            this.fab = e > 60
                        }
                    },
                    toTop: function() {
                        this.$vuetify.goTo(0)
                    }
                }
            },
            rs = is,
            ns = s("7496"),
            os = s("f6c4"),
            cs = s("0789"),
            ls = s("269a"),
            fs = s.n(ls),
            us = s("f977"),
            ds = Object(d["a"])(rs, n, o, !1, null, "6d278358", null),
            ps = ds.exports;
        m()(ds, {
            VApp: ns["a"],
            VBtn: b["a"],
            VIcon: C["a"],
            VMain: os["a"],
            VScaleTransition: cs["d"]
        }), fs()(ds, {
            Scroll: us["b"]
        });
        var ms = s("f309");
        a["a"].use(ms["a"]);
        var vs = new ms["a"]({
                theme: {
                    themes: {
                        light: {
                            primary: "#119DA4",
                            secondary: "#171b34",
                            accent: "3D87E4"
                        }
                    }
                }
            }),
            hs = s("bc3a"),
            bs = s.n(hs),
            gs = {
                install: function(t, e) {
                    t.prototype.$ajax = bs.a
                }
            };
        a["a"].config.productionTip = !1, a["a"].use(gs), a["a"].use(r.a), new a["a"]({
            vuetify: vs,
            render: function(t) {
                return t(ps)
            }
        }).$mount("#app")
    },
    "5c4f": function(t, e, s) {
        t.exports = s.p + "img/dev1.af7c83f3.png"
    },
    "5d1a": function(t, e, s) {
        t.exports = s.p + "img/order3.5332fd97.png"
    },
    "68ef": function(t, e, s) {},
    "69ef": function(t, e, s) {},
    "6f123": function(t, e, s) {
        t.exports = s.p + "img/exp4.f5f4761f.png"
    },
    "750f": function(t, e, s) {
        t.exports = s.p + "img/order2.c3218ce4.png"
    },
    7519: function(t, e, s) {},
    "7a41": function(t, e, s) {
        t.exports = s.p + "img/price1.5332fd97.png"
    },
    "7ffa": function(t, e, s) {
        "use strict";
        s("004d")
    },
    9629: function(t, e, s) {
        t.exports = s.p + "img/money.788ba6ab.png"
    },
    "963f": function(t, e, s) {},
    "981b": function(t, e, s) {
        t.exports = s.p + "img/inaya.81a2cfc3.png"
    },
    a1d8: function(t, e, s) {
        t.exports = s.p + "img/logo.5be9dfb1.png"
    },
    a20f: function(t, e, s) {
        t.exports = s.p + "img/te2.19a6de47.png"
    },
    a210: function(t, e, s) {
        t.exports = s.p + "img/4.cee1108b.png"
    },
    a575: function(t, e, s) {
        "use strict";
        s("f1b6")
    },
    a8e6: function(t, e, s) {
        t.exports = s.p + "img/time.3dfa287d.png"
    },
    aa33: function(t, e, s) {
        t.exports = s.p + "img/5.e9c11dd4.png"
    },
    aac7: function(t, e, s) {
        "use strict";
        s("d804")
    },
    ab2e: function(t, e, s) {},
    b0c9: function(t, e, s) {
        t.exports = s.p + "img/securit.2c3807b7.png"
    },
    b55e: function(t, e, s) {
        "use strict";
        s("de7d")
    },
    b597: function(t, e, s) {
        t.exports = s.p + "img/vib2.ccad47f7.png"
    },
    b671: function(t, e, s) {
        "use strict";
        s("bb3f")
    },
    b9d1: function(t, e, s) {
        "use strict";
        s("ab2e")
    },
    ba55: function(t, e, s) {},
    bb3f: function(t, e, s) {},
    bc40: function(t, e, s) {
        t.exports = s.p + "img/nedvij.44535a17.png"
    },
    c0b3: function(t, e, s) {
        t.exports = s.p + "img/3.7f92c34d.png"
    },
    c0e6: function(t, e, s) {
        t.exports = s.p + "img/error.5c841bfb.png"
    },
    cfb7: function(t, e, s) {
        t.exports = s.p + "img/obucenie.d9e6d411.png"
    },
    d562: function(t, e, s) {},
    d804: function(t, e, s) {},
    d925: function(t, e, s) {
        t.exports = s.p + "img/order4.aedd4846.png"
    },
    d94c: function(t, e, s) {
        t.exports = s.p + "img/exp2.431b83f4.png"
    },
    dbef: function(t, e, s) {
        t.exports = s.p + "img/consult.6a192e11.png"
    },
    dd0c: function(t, e, s) {
        t.exports = s.p + "img/exp3.0f5d843e.png"
    },
    de7d: function(t, e, s) {},
    e10a: function(t, e, s) {
        t.exports = s.p + "img/viber_logo.5e2b1152.png"
    },
    e4be: function(t, e, s) {},
    f1b6: function(t, e, s) {}
});
//# sourceMappingURL=app.bc237cf3.js.map