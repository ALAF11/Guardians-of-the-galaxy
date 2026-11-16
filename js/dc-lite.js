// Motor mínimo que interpreta o formato do protótipo feito no canvas:
//   {{caminho}} para valores, <sc-if value>, <sc-for list as>, on*="{{função}}"
//   e uma classe com state / setState / renderVals / componentDidMount.
// O DOM é atualizado no sítio (não recriado), para as animações CSS não
// recomeçarem sempre que o contador da fita avança um segundo.
(function () {
  'use strict';

  const EXPR = /\{\{\s*([^}]+?)\s*\}\}/g;
  const ONLY = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;
  let nextId = 1;

  function lookup(scope, path) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    return path.split('.').reduce(function (v, key) {
      return v === null || v === undefined ? undefined : v[key];
    }, scope);
  }

  function interpolate(scope, raw) {
    return raw.replace(EXPR, function (_, path) {
      const v = lookup(scope, path);
      return v === null || v === undefined ? '' : String(v);
    });
  }

  // Um atributo que é só {{x}} devolve o valor tal como é (booleano, lista, função)
  function evaluate(scope, raw) {
    const m = raw && raw.match(ONLY);
    return m ? lookup(scope, m[1]) : interpolate(scope, raw || '');
  }

  function idOf(node) {
    if (!node.__dcId) node.__dcId = nextId++;
    return node.__dcId;
  }

  // O onChange do formato original dispara a cada tecla, como o evento input
  function eventName(tag, name) {
    return name === 'change' && (tag === 'input' || tag === 'textarea') ? 'input' : name;
  }

  // ---------- Template → árvore virtual ----------

  function build(nodes, scope, out) {
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.nodeType === 3) {
        out.push({ src: node, text: interpolate(scope, node.nodeValue) });
        return;
      }
      if (node.nodeType !== 1) return;

      const tag = node.localName;

      if (tag === 'sc-if') {
        if (evaluate(scope, node.getAttribute('value'))) build(node.childNodes, scope, out);
        return;
      }

      if (tag === 'sc-for') {
        const list = evaluate(scope, node.getAttribute('list')) || [];
        const as = node.getAttribute('as');
        list.forEach(function (item) {
          const inner = Object.create(scope);
          inner[as] = item;
          build(node.childNodes, inner, out);
        });
        return;
      }

      const v = { src: node, tag: tag, ns: node.namespaceURI, attrs: {}, events: {}, children: [] };
      Array.prototype.forEach.call(node.attributes, function (a) {
        if (a.name.indexOf('hint-') === 0) return;
        if (a.name.slice(0, 2) === 'on') {
          const fn = evaluate(scope, a.value);
          if (typeof fn === 'function') v.events[eventName(tag, a.name.slice(2))] = fn;
          return;
        }
        v.attrs[a.name] = interpolate(scope, a.value);
      });
      build(node.childNodes, scope, v.children);
      out.push(v);
    });
    return out;
  }

  // ---------- Árvore virtual → DOM ----------

  function create(v) {
    let el;
    if (v.tag === undefined) {
      el = document.createTextNode(v.text);
    } else {
      el = v.ns && v.ns !== 'http://www.w3.org/1999/xhtml'
        ? document.createElementNS(v.ns, v.tag)
        : document.createElement(v.tag);
      el.__attrs = {};
      el.__events = {};
      el.__bound = {};
      update(el, v);
    }
    el.__key = v.key;
    return el;
  }

  function update(el, v) {
    if (v.tag === undefined) {
      if (el.nodeValue !== v.text) el.nodeValue = v.text;
      return;
    }

    Object.keys(el.__attrs).forEach(function (name) {
      if (!(name in v.attrs)) el.removeAttribute(name);
    });
    Object.keys(v.attrs).forEach(function (name) {
      const val = v.attrs[name];
      if (el.getAttribute(name) !== val) el.setAttribute(name, val);
      if (name === 'value' && 'value' in el && el.value !== val) el.value = val;
    });
    el.__attrs = v.attrs;

    el.__events = v.events;
    Object.keys(v.events).forEach(function (type) {
      if (el.__bound[type]) return;
      el.__bound[type] = true;
      el.addEventListener(type, function (e) {
        const fn = el.__events[type];
        if (fn) fn(e);
      });
    });

    patch(el, v.children);
  }

  // Reaproveita os nós pela origem no template (e pela ordem, nas listas),
  // como faria um componente: o que aparece de novo é criado, o que sai é removido.
  function patch(parent, vnodes) {
    const seen = {};
    vnodes.forEach(function (v) {
      const id = idOf(v.src);
      seen[id] = (seen[id] || 0) + 1;
      v.key = id + ':' + seen[id];
    });
    const keep = {};
    vnodes.forEach(function (v) { keep[v.key] = true; });

    const pool = {};
    Array.prototype.slice.call(parent.childNodes).forEach(function (el) {
      if (el.__key && keep[el.__key]) pool[el.__key] = el;
      else parent.removeChild(el);
    });

    vnodes.forEach(function (v, i) {
      let el = pool[v.key];
      if (el) update(el, v);
      else el = create(v);
      const at = parent.childNodes[i];
      if (at !== el) parent.insertBefore(el, at || null);
    });
  }

  // ---------- Componente ----------

  function DCLogic(props) {
    this.props = props || {};
    this.state = {};
  }

  DCLogic.prototype.setState = function (update) {
    const patchState = typeof update === 'function' ? update(this.state, this.props) : update;
    if (!patchState) return;
    this.state = Object.assign({}, this.state, patchState);
    if (this.__schedule) this.__schedule();
  };

  function mount(Component, container, template, props) {
    const component = new Component(props);
    let queued = false;

    function render() {
      queued = false;
      patch(container, build(template.content.childNodes, component.renderVals(), []));
    }

    component.__schedule = function () {
      if (queued) return;
      queued = true;
      queueMicrotask(render);
    };

    render();
    if (component.componentDidMount) component.componentDidMount();
    return component;
  }

  window.DCLogic = DCLogic;
  window.mountDC = mount;
})();
