// AnalizarLogo.jsx — SOLO LECTURA. No modifica nada del proyecto.
// Recorre la composición "Logo" y todas sus precomposiciones anidadas, y vuelca
// cada propiedad animada (transformación, efectos, máscaras, expresiones) con
// tiempos, valores, tipo de interpolación y ease temporal (velocidad / influencia).
// Uso: Archivo > Scripts > Ejecutar archivo de script... -> genera AnalisisLogo.txt en el Escritorio.

(function () {
    var ROOT_NAME = "Logo";
    var out = [];
    var visited = {};

    function findComp(name) {
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (it instanceof CompItem && it.name === name) return it;
        }
        return null;
    }

    function fmt(v) {
        if (v === null || v === undefined) return "-";
        if (v instanceof Array) {
            var a = [];
            for (var i = 0; i < v.length; i++) a.push(fmt(v[i]));
            return "[" + a.join(", ") + "]";
        }
        if (typeof v === "number") return String(Math.round(v * 1000) / 1000);
        return String(v);
    }

    function interpName(t) {
        if (t === KeyframeInterpolationType.LINEAR) return "Linear";
        if (t === KeyframeInterpolationType.BEZIER) return "Bezier";
        if (t === KeyframeInterpolationType.HOLD) return "Hold";
        return String(t);
    }

    function easeStr(arr) {
        var s = [];
        for (var i = 0; i < arr.length; i++) {
            s.push("vel " + fmt(arr[i].speed) + " / infl " + fmt(arr[i].influence) + "%");
        }
        return s.join(" | ");
    }

    function frames(t, comp) {
        return Math.round(t * comp.frameRate);
    }

    function dumpProp(prop, path, comp, indent) {
        var hasKeys = prop.numKeys > 0;
        var hasExpr = prop.canSetExpression && prop.expression !== "";
        if (!hasKeys && !hasExpr) return;

        out.push(indent + path + (hasExpr && !prop.expressionEnabled ? "  (expresión DESACTIVADA)" : ""));
        if (hasExpr) {
            out.push(indent + "  expresión: " + prop.expression.replace(/\r?\n/g, " ⏎ "));
        }
        for (var k = 1; k <= prop.numKeys; k++) {
            var t = prop.keyTime(k);
            var line = indent + "  key " + k + "  t=" + fmt(t) + "s (f" + frames(t, comp) + ")"
                + "  valor=" + fmt(prop.keyValue(k))
                + "  interp in/out=" + interpName(prop.keyInInterpolationType(k)) + "/" + interpName(prop.keyOutInterpolationType(k));
            try {
                line += "  easeIn{" + easeStr(prop.keyInTemporalEase(k)) + "}"
                    + "  easeOut{" + easeStr(prop.keyOutTemporalEase(k)) + "}";
            } catch (e) {}
            try {
                if (prop.keyTemporalAutoBezier(k)) line += "  [auto-bezier]";
                if (prop.keyTemporalContinuous(k)) line += "  [continuous]";
                if (prop.isSpatial && prop.keyRoving(k)) line += "  [roving]";
            } catch (e2) {}
            out.push(line);
        }
        if (prop.numKeys >= 2) {
            var dur = prop.keyTime(prop.numKeys) - prop.keyTime(1);
            out.push(indent + "  tramo animado: " + fmt(prop.keyTime(1)) + "s → " + fmt(prop.keyTime(prop.numKeys)) + "s (" + fmt(dur) + "s, " + frames(dur, comp) + " frames)");
        }
    }

    function walk(group, path, comp, indent) {
        for (var i = 1; i <= group.numProperties; i++) {
            var p = group.property(i);
            if (!p) continue;
            var name = path + " > " + p.name;
            if (p.propertyType === PropertyType.PROPERTY) {
                dumpProp(p, name, comp, indent);
            } else {
                walk(p, name, comp, indent);
            }
        }
    }

    function listEffects(layer, indent) {
        var fx = layer.property("ADBE Effect Parade");
        if (!fx || fx.numProperties === 0) return;
        var names = [];
        for (var i = 1; i <= fx.numProperties; i++) {
            var e = fx.property(i);
            names.push(e.name + " (" + e.matchName + ")" + (e.enabled ? "" : " [OFF]"));
        }
        out.push(indent + "Efectos: " + names.join(", "));
    }

    function dumpComp(comp, depth) {
        var indent = new Array(depth + 1).join("    ");
        out.push(indent + "=== COMP \"" + comp.name + "\" (id " + comp.id + ")  " + comp.width + "x" + comp.height
            + "  " + comp.frameRate + "fps  dur " + fmt(comp.duration) + "s  work area " + fmt(comp.workAreaStart) + "s +" + fmt(comp.workAreaDuration) + "s");
        if (visited[comp.id]) {
            out.push(indent + "  (ya analizada arriba)");
            return;
        }
        visited[comp.id] = true;

        for (var i = 1; i <= comp.numLayers; i++) {
            var L = comp.layer(i);
            var src = (L.source ? (L.source instanceof CompItem ? "precomp \"" + L.source.name + "\" (id " + L.source.id + ")" : "footage \"" + L.source.name + "\"") : "sin source");
            out.push("");
            out.push(indent + "-- Capa " + i + ": \"" + L.name + "\"  [" + src + "]"
                + (L.enabled ? "" : "  [OCULTA]")
                + "  in " + fmt(L.inPoint) + "s / out " + fmt(L.outPoint) + "s / start " + fmt(L.startTime) + "s"
                + (L.stretch !== 100 ? "  stretch " + fmt(L.stretch) + "%" : "")
                + (L.parent ? "  parent \"" + L.parent.name + "\"" : "")
                + (L.blendingMode !== BlendingMode.NORMAL ? "  blend " + L.blendingMode : "")
                + (L.hasTrackMatte ? "  trackMatte " + L.trackMatteType : "")
                + (L.motionBlur ? "  motionBlur" : "")
                + (L.timeRemapEnabled ? "  TIME REMAP" : ""));
            listEffects(L, indent + "   ");
            walk(L, "", comp, indent + "   ");
        }
        for (var j = 1; j <= comp.numLayers; j++) {
            var s = comp.layer(j).source;
            if (s && s instanceof CompItem) {
                out.push("");
                dumpComp(s, depth + 1);
            }
        }
    }

    var root = findComp(ROOT_NAME);
    if (!root) { alert("No encontré la composición \"" + ROOT_NAME + "\""); return; }
    dumpComp(root, 0);

    var f = new File(Folder.desktop.fsName + "/AnalisisLogo.txt");
    f.encoding = "UTF-8";
    f.open("w");
    f.write(out.join("\n"));
    f.close();
    alert("Listo. Archivo generado:\n" + f.fsName);
})();
