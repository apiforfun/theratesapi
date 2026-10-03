// Progressive enhancement for every page. Everything works without this file; it adds the
// mobile menu, code tabs, copy buttons, the try-it box and the docs section highlight.
(function () {
  function initMenu () {
    const toggle = document.querySelector('.menu-toggle')
    const nav = document.getElementById('site-nav')
    if (!toggle || !nav) return
    toggle.addEventListener('click', function () {
      const open = toggle.getAttribute('aria-expanded') !== 'true'
      toggle.setAttribute('aria-expanded', String(open))
      nav.classList.toggle('is-open', open)
    })
  }

  // Shows one tab panel per [data-tabs] group. Panels are all visible without JS.
  function initTabs () {
    document.querySelectorAll('[data-tabs]').forEach(function (group) {
      const tabs = Array.from(group.querySelectorAll('[role=tab]'))
      function select (tab) {
        tabs.forEach(function (t) {
          const selected = t === tab
          t.setAttribute('aria-selected', String(selected))
          t.tabIndex = selected ? 0 : -1
          document.getElementById(t.getAttribute('aria-controls')).hidden = !selected
        })
      }
      tabs.forEach(function (tab, i) {
        tab.addEventListener('click', function () { select(tab) })
        tab.addEventListener('keydown', function (event) {
          const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
          if (!step) return
          const next = tabs[(i + step + tabs.length) % tabs.length]
          select(next)
          next.focus()
        })
      })
      select(tabs[0])
    })
  }

  // A copy button copies its group's visible tab panel, or the element named by data-copy-from.
  // Panels may carry data-copy with cleaner text than they display.
  function initCopy () {
    document.addEventListener('click', function (event) {
      const button = event.target.closest('.copy')
      if (!button) return
      const group = button.closest('[data-tabs]')
      const source = group
        ? group.querySelector('[role=tabpanel]:not([hidden])')
        : document.querySelector(button.dataset.copyFrom)
      navigator.clipboard.writeText(source.dataset.copy || source.textContent).then(function () {
        button.textContent = 'Copied'
      }, function () {
        button.textContent = 'Copy failed'
      }).then(function () {
        setTimeout(function () { button.textContent = 'Copy' }, 1500)
      })
    })
  }

  // Runs the home page request in place. Without JS the form submits to /api/latest instead.
  function initTry () {
    const form = document.querySelector('[data-try]')
    if (!form) return
    const urlEl = form.querySelector('[data-try-url]')
    const output = form.querySelector('[data-try-output]')
    const status = form.querySelector('[data-try-status]')
    const run = form.querySelector('button[type=submit]')

    function requestPath () {
      const params = new URLSearchParams()
      const base = form.elements.base.value
      const symbols = form.elements.symbols.value.replace(/\s+/g, '').toUpperCase()
      if (base !== 'EUR') params.set('base', base)
      if (symbols) params.set('symbols', symbols)
      const query = params.toString().replace(/%2C/gi, ',')
      return '/api/' + (form.elements.date.value || 'latest') + (query ? '?' + query : '')
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault()
      const path = requestPath()
      urlEl.textContent = 'https://theratesapi.com' + path
      run.disabled = true
      status.textContent = 'Loading...'
      fetch(path)
        .then(function (res) {
          return res.json().then(function (body) {
            output.innerHTML = window.highlightJson(body)
            status.textContent = res.ok ? '' : 'HTTP ' + res.status
          }, function () {
            output.textContent = ''
            status.textContent = 'HTTP ' + res.status + ': the server sent an unexpected response.'
          })
        })
        .catch(function () {
          output.textContent = ''
          status.textContent = 'Request failed. Check your connection and try again.'
        })
        .finally(function () { run.disabled = false })
    })
  }

  // Marks the docs section bar link for the section crossing the middle of the viewport.
  function initScrollSpy () {
    const links = Array.from(document.querySelectorAll('.docs-nav a'))
    if (!links.length || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return
        links.forEach(function (link) {
          link.classList.toggle('is-current', link.hash === '#' + entry.target.id)
        })
      })
    }, { rootMargin: '-45% 0px -50% 0px' })
    links.forEach(function (link) { observer.observe(document.querySelector(link.hash)) })
  }

  initMenu()
  initTabs()
  initCopy()
  initTry()
  initScrollSpy()
})()
