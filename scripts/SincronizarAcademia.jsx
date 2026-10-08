// SincronizarAcademia.jsx
// Copia los efectos (valores, keyframes, curvas de velocidad/influencia y expresiones) de las
// precomposiciones del logo a "Academia Cucuta" y "Academia Cucuta 2", sincronizados con la
// línea de tiempo de "Logo".
//
// SEGURIDAD:
//   - "Logo", "LOGOS CÚCUTA", "CucutaColor" y todo lo que cuelga de "Logo" solo se LEEN, nunca se tocan.
//     El script aborta si alguna comp que va a modificar forma parte del árbol de "Logo".
//   - Con APPLY_ON_COPY = true (por defecto) se trabaja sobre DUPLICADOS ("Academia Cucuta FX" y
//     "Academia Cucuta 2 FX"); las comps originales y "Comp 1" quedan intactas.
//   - Todo va en un único grupo de deshacer: un Ctrl+Z (Cmd+Z) lo revierte entero.
//   - Genera un informe en el Escritorio: SincronizarAcademia_log.txt
//
// Uso: Archivo > Scripts > Ejecutar archivo de script...

(function () {
    // ------------------------------------------------------------------ CONFIGURACIÓN
    var CONFIG = {
        APPLY_ON_COPY: true,   // false = aplicar directamente sobre las comps originales
        COPY_SUFFIX: " FX",
        LOGO_COMP: "Logo",
        jobs: [
            {
                // "Academia Cucuta": tal cual como en LOGOS CÚCUTA (capa LogoBrillo dentro de Logo)
                target: "Academia Cucuta",
                source: "LOGOS CÚCUTA",
                logoLayer: "LogoBrillo",   // capa de "Logo" que contiene la comp origen (para sincronizar)
                copyFill: true,            // tal cual: también copia el color del Fill
                autoMatchNames: true,      // capas con el mismo nombre se emparejan solas (Escudo -> Escudo)
                map: {}                    // emparejamientos extra  "capa destino": "capa origen"
            },
            {
                // "Academia Cucuta 2": mismo sistema que la base del logo (CucutaColor, Fill + Radial Wipe)
                target: "Academia Cucuta 2",
                source: "CucutaColor",
                logoLayer: "CucutaColor",
                copyFill: false,           // conserva los colores propios (no añade ni pisa Fill)
                autoMatchNames: true,
                map: {
                    "Escudo": "LadoRojo",
                    "Negro2": "LadoNegro",
                    "Blanco1": "LadoNegro",
                    "Negro1": "LadoNegro",
                    "ACADEMIA": "Estrella",
                    "CucutaDeportivo": "Estrella"
                }
            }
        ]
    };
    // ---------------------------------------------------------------------------------

    var log = [];
    var errors = 0;
    function L(s) { log.push(s); }
    function W(s) { log.push("  ! " + s); errors++; }

    function norm(s) {
        s = String(s).replace(/́/g, "");
        var from = "ÁÉÍÓÚÜÑáéíóúüñ", to = "AEIOUUNaeiouun";
        var r = "";
        for (var i = 0; i < s.length; i++) {
            var c = s.charAt(i), k = from.indexOf(c);
            r += (k >= 0) ? to.charAt(k) : c;
        }
        return r.replace(/[\s ]+/g, " ").replace(/^\s+|\s+$/g, "").toUpperCase();
    }

    function compsNamed(name) {
        var res = [], n = norm(name);
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (it instanceof CompItem && norm(it.name) === n) res.push(it);
        }
        return res;
    }

    function uniqueComp(name) {
        var c = compsNamed(name);
        if (c.length === 0) throw new Error("No existe la composición \"" + name + "\"");
        if (c.length > 1) throw new Error("Hay " + c.length + " composiciones llamadas \"" + name + "\"; renombra las duplicadas");
        return c[0];
    }

    function reachable(comp, set) {
        if (set[comp.id]) return set;
        set[comp.id] = true;
        for (var i = 1; i <= comp.numLayers; i++) {
            var s = comp.layer(i).source;
            if (s && s instanceof CompItem) reachable(s, set);
        }
        return set;
    }

    function layerUsing(comp, src) {
        for (var i = 1; i <= comp.numLayers; i++) {
            if (comp.layer(i).source === src) return comp.layer(i);
        }
        return null;
    }

    function layerNamed(comp, name) {
        var n = norm(name);
        for (var i = 1; i <= comp.numLayers; i++) {
            if (norm(comp.layer(i).name) === n) return comp.layer(i);
        }
        return null;
    }

    function fmt(v) {
        if (v instanceof Array) {
            var a = [];
            for (var i = 0; i < v.length; i++) a.push(fmt(v[i]));
            return "[" + a.join(",") + "]";
        }
        if (typeof v === "number") return String(Math.round(v * 1000) / 1000);
        return String(v);
    }

    function layerSize(layer) {
        try { if (layer.width && layer.height) return [layer.width, layer.height]; } catch (e) {}
        try { var r = layer.sourceRectAtTime(0, false); return [r.width, r.height]; } catch (e2) {}
        return [1, 1];
    }

    function isSpatialType(p) {
        return p.propertyValueType === PropertyValueType.TwoD_SPATIAL ||
               p.propertyValueType === PropertyValueType.ThreeD_SPATIAL;
    }

    function scaleVal(v, p, k) {
        if (!isSpatialType(p) || !(v instanceof Array)) return v;
        var r = v.slice(0);
        r[0] = v[0] * k[0];
        r[1] = v[1] * k[1];
        return r;
    }

    function copyEase(arr, f) {
        var r = [];
        for (var i = 0; i < arr.length; i++) r.push(new KeyframeEase(arr[i].speed * f, arr[i].influence));
        return r;
    }

    // Copia una propiedad hoja (valor o keyframes + curvas + expresión)
    function copyLeaf(sp, tp, offset, k, path) {
        var t = sp.propertyValueType;
        if (t === PropertyValueType.NO_VALUE || t === PropertyValueType.CUSTOM_VALUE) return;
        try {
            while (tp.numKeys > 0) tp.removeKey(1);

            if (sp.numKeys === 0) {
                tp.setValue(scaleVal(sp.value, sp, k));
            } else {
                var spd = isSpatialType(sp) ? (k[0] + k[1]) / 2 : 1;
                var idx = [], i;
                for (i = 1; i <= sp.numKeys; i++) {
                    var time = sp.keyTime(i) + offset;
                    tp.setValueAtTime(time, scaleVal(sp.keyValue(i), sp, k));
                    idx.push(time);
                }
                for (i = 1; i <= sp.numKeys; i++) {
                    var ti = tp.nearestKeyIndex(idx[i - 1]);
                    try { tp.setTemporalEaseAtKey(ti, copyEase(sp.keyInTemporalEase(i), spd), copyEase(sp.keyOutTemporalEase(i), spd)); } catch (e1) {}
                    try { tp.setTemporalContinuousAtKey(ti, sp.keyTemporalContinuous(i)); } catch (e2) {}
                    try { tp.setTemporalAutoBezierAtKey(ti, sp.keyTemporalAutoBezier(i)); } catch (e3) {}
                    if (sp.isSpatial) {
                        try {
                            tp.setSpatialTangentsAtKey(ti, scaleVal(sp.keyInSpatialTangent(i), sp, k), scaleVal(sp.keyOutSpatialTangent(i), sp, k));
                            tp.setSpatialContinuousAtKey(ti, sp.keySpatialContinuous(i));
                            tp.setSpatialAutoBezierAtKey(ti, sp.keySpatialAutoBezier(i));
                        } catch (e4) {}
                    }
                    try { tp.setInterpolationTypeAtKey(ti, sp.keyInInterpolationType(i), sp.keyOutInterpolationType(i)); } catch (e5) {}
                }
                for (i = 1; i <= sp.numKeys; i++) {
                    try { if (sp.isSpatial && sp.keyRoving(i)) tp.setRovingAtKey(tp.nearestKeyIndex(idx[i - 1]), true); } catch (e6) {}
                }
                L("      " + path + ": " + sp.numKeys + " keys  " + fmt(idx[0]) + "s -> " + fmt(idx[idx.length - 1]) + "s");
            }

            if (sp.canSetExpression) {
                if (sp.expression !== "") {
                    tp.expression = sp.expression;
                    tp.expressionEnabled = sp.expressionEnabled;
                    L("      " + path + ": expresión copiada");
                } else if (tp.expression !== "") {
                    tp.expression = "";
                }
            }
        } catch (e) {
            W(path + ": " + e.toString());
        }
    }

    function copyGroup(sg, tg, offset, k, path) {
        for (var i = 1; i <= sg.numProperties; i++) {
            var sp = sg.property(i);
            var tp = null;
            try { tp = tg.property(sp.matchName); } catch (e) {}
            if (!tp) { try { tp = tg.property(i); } catch (e2) {} }
            if (!tp) continue;
            var p = path + " > " + sp.name;
            if (sp.propertyType === PropertyType.PROPERTY) copyLeaf(sp, tp, offset, k, p);
            else copyGroup(sp, tp, offset, k, p);
        }
    }

    function findEffect(parade, matchName, nth) {
        var count = 0;
        for (var i = 1; i <= parade.numProperties; i++) {
            if (parade.property(i).matchName === matchName) {
                count++;
                if (count === nth) return parade.property(i);
            }
        }
        return null;
    }

    function copyEffects(srcLayer, tgtLayer, offset, copyFill) {
        var sp = srcLayer.property("ADBE Effect Parade");
        var ss = layerSize(srcLayer), ts = layerSize(tgtLayer);
        var k = [ts[0] / ss[0], ts[1] / ss[1]];
        var seen = {};
        if (!sp || sp.numProperties === 0) { L("    (la capa origen no tiene efectos)"); return; }
        for (var i = 1; i <= sp.numProperties; i++) {
            var se = sp.property(i);
            var mn = se.matchName;
            seen[mn] = (seen[mn] || 0) + 1;
            try {
                // AE invalida referencias al añadir propiedades: se vuelve a pedir el parade cada vez
                var te = findEffect(tgtLayer.property("ADBE Effect Parade"), mn, seen[mn]);
                if (mn === "ADBE Fill" && !copyFill) {
                    L("    " + se.name + ": se conserva el Fill propio del destino" + (te ? "" : " (no tiene; no se añade)"));
                    continue;
                }
                var action = te ? "actualizado" : "añadido";
                if (!te) te = tgtLayer.property("ADBE Effect Parade").addProperty(mn);
                var teIndex = te.propertyIndex;
                try { te.name = se.name; } catch (eName) {}
                te = tgtLayer.property("ADBE Effect Parade").property(teIndex);
                te.enabled = se.enabled;
                L("    " + se.name + " (" + mn + ") " + action);
                copyGroup(se, te, offset, k, se.name);
            } catch (e) {
                W(tgtLayer.name + " / " + se.name + ": " + e.toString());
            }
        }
    }

    // ------------------------------------------------------------------ PRINCIPAL
    app.beginUndoGroup("Sincronizar Academia con Logo");
    try {
        var logo = uniqueComp(CONFIG.LOGO_COMP);
        var protectedSet = reachable(logo, {});

        for (var j = 0; j < CONFIG.jobs.length; j++) {
            var job = CONFIG.jobs[j];
            L("");
            L("=== " + job.target + "  <-  " + job.source);

            var srcComp = uniqueComp(job.source);
            var tgtOrig = uniqueComp(job.target);
            if (protectedSet[tgtOrig.id]) throw new Error("\"" + job.target + "\" forma parte del árbol de Logo; no se toca.");

            // Sincronización: tiempo origen -> tiempo de Logo -> tiempo de la comp maestra -> tiempo destino
            var logoLayer = layerUsing(logo, srcComp) || layerNamed(logo, job.logoLayer);
            if (logoLayer && logoLayer.source !== srcComp) {
                W("la capa \"" + logoLayer.name + "\" de Logo no usa \"" + srcComp.name + "\" (usa \"" + (logoLayer.source ? logoLayer.source.name : "?") + "\"); se sincroniza con su posición igualmente");
            }
            var offset = logoLayer ? logoLayer.startTime : 0;
            if (logoLayer && logoLayer.stretch !== 100) W("\"" + logoLayer.name + "\" tiene stretch " + logoLayer.stretch + "%; no se compensa");
            if (logoLayer && logoLayer.timeRemapEnabled) W("\"" + logoLayer.name + "\" tiene time remap; no se compensa");

            var master = null;
            for (var m = 1; m <= app.project.numItems && !master; m++) {
                var it = app.project.item(m);
                if (it instanceof CompItem && layerUsing(it, logo) && layerUsing(it, tgtOrig)) master = it;
            }
            if (master) {
                offset += layerUsing(master, logo).startTime - layerUsing(master, tgtOrig).startTime;
                L("Sincronizado vía \"" + master.name + "\"  (offset " + fmt(offset) + "s)");
            } else {
                L("Sin comp maestra común; sincronizado con la línea de tiempo de Logo (offset " + fmt(offset) + "s)");
            }

            var tgt = tgtOrig;
            if (CONFIG.APPLY_ON_COPY) {
                var newName = job.target + CONFIG.COPY_SUFFIX;
                if (compsNamed(newName).length > 0) newName += " " + new Date().getTime();
                tgt = tgtOrig.duplicate();
                tgt.name = newName;
                L("Trabajando sobre la copia \"" + newName + "\" (original intacto)");
            }
            if (protectedSet[tgt.id]) throw new Error("Seguridad: la comp destino pertenece a Logo.");

            for (var li = 1; li <= tgt.numLayers; li++) {
                var tl = tgt.layer(li);
                var srcName = job.map[tl.name];
                if (!srcName && job.autoMatchNames && layerNamed(srcComp, tl.name)) srcName = tl.name;
                if (!srcName) { L("  - " + tl.name + ": sin emparejar, no se toca"); continue; }
                var sl = layerNamed(srcComp, srcName);
                if (!sl) { W(tl.name + ": no existe la capa origen \"" + srcName + "\" en " + srcComp.name); continue; }
                L("  - " + tl.name + "  <-  " + srcComp.name + " / " + sl.name);
                copyEffects(sl, tl, offset, job.copyFill);
            }
        }
    } catch (err) {
        W("ABORTADO: " + err.toString());
    } finally {
        app.endUndoGroup();
    }

    var path = "";
    try {
        var f = new File(Folder.desktop.fsName + "/SincronizarAcademia_log.txt");
        f.encoding = "UTF-8";
        f.open("w");
        f.write(log.join("\n"));
        f.close();
        path = f.fsName;
    } catch (e) {}

    alert((errors ? "Terminado con " + errors + " avisos." : "Terminado sin errores.") +
          "\nSi no te gusta el resultado: Edición > Deshacer (un solo paso)." +
          (path ? "\nInforme: " + path : "\n(No se pudo escribir el informe: activa 'Permitir que los scripts escriban archivos' en Preferencias > Scripts y expresiones)"));
})();
