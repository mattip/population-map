/* UI text, one object per language. {name} placeholders are filled by t().
   Adding a language means adding a block here and a button in index.html. */
window.STRINGS = {

  en: {
    dir: 'ltr',
    locale: 'en-US',
    title: 'Israel population by locality',
    docTitle: 'Israel population by locality, 2023',

    toolsLabel: 'Selection tools',
    mapLabel: 'Map of localities',
    rect: 'Rectangle',
    lasso: 'Lasso',
    poly: 'Polygon',
    clear: 'Clear',
    permalink: 'Copy link',
    rectTitle: 'Drag on the map to select a rectangle (R)',
    lassoTitle: 'Drag on the map to trace a freehand outline (L)',
    polyTitle: 'Click to place corners, double-click or Enter to close (P)',
    clearTitle: 'Clear the selection (Esc)',
    permalinkTitle: 'Copy a link to this view and selection',

    hintRect: 'Drag to draw a rectangle',
    hintLasso: 'Drag to trace an outline',
    hintPoly: 'Click to add corners · double-click or Enter to close · Esc to cancel',
    hintPolyCount: 'Click to add corners · {n} so far',
    hintPolyClose: 'Double-click, press Enter, or click the first corner to close',

    copied: 'Copied',
    copyManually: 'Copy from the address bar',

    scopeAll: 'All localities, whole country',
    scopeRect: 'Inside the rectangle',
    scopePoly: 'Inside the traced area',
    zoomToSelection: 'zoom to selection',
    editHint: 'Drag a {corner} corner to reshape, or the {centre} centre to move the whole selection.',
    resizeTitle: 'Drag to resize',
    reshapeTitle: 'Drag to reshape',
    moveTitle: 'Drag to move the whole selection',

    peopleCount: 'people · {places}',
    onePlace: '1 locality',
    manyPlaces: '{n} localities',
    shareOfCountry: '{share} of the {total} nationwide',

    composition: 'Composition',
    colGroup: 'Group',
    colPeople: 'People',
    colShare: 'Share',
    total: 'Total',

    localities: 'Localities',
    listCount: '({n}, largest first)',
    colName: 'Name',
    colTotal: 'Total',
    colJews: 'Jews & others',
    colArabs: 'Arabs',
    colForeign: 'Foreign',
    listEmpty: 'No localities inside the selection',
    listNote: 'Showing the largest {cap} of {n} localities. The totals above and the CSV cover all of them.',
    downloadCsv: 'Download CSV',

    legendLargest: 'Largest group:',
    legendSizes: '10k · 100k · 1M people',
    tipTotal: 'total',

    noData: 'no data',
    loadError: 'could not load the data — {message}',
    source: 'Source: Israel Central Bureau of Statistics, <a href="{url}" target="_blank" rel="noopener"><em>Localities in Israel</em></a> — the 2023 final file. Localities whose figures CBS does not publish are omitted. Each locality is one point (its CBS reference coordinate), so a locality counts in full or not at all.'
  },

  he: {
    dir: 'rtl',
    locale: 'he-IL',
    title: 'אוכלוסיית ישראל לפי יישוב',
    docTitle: 'אוכלוסיית ישראל לפי יישוב, 2023',

    toolsLabel: 'כלי בחירה',
    mapLabel: 'מפת היישובים',
    rect: 'מלבן',
    lasso: 'סימון חופשי',
    poly: 'מצולע',
    clear: 'ניקוי',
    permalink: 'העתקת קישור',
    rectTitle: 'גררו על המפה כדי לבחור מלבן (R)',
    lassoTitle: 'גררו על המפה כדי לשרטט קו חופשי (L)',
    polyTitle: 'לחצו כדי להוסיף פינות, לחיצה כפולה או Enter לסגירה (P)',
    clearTitle: 'ניקוי הבחירה (Esc)',
    permalinkTitle: 'העתקת קישור לתצוגה ולבחירה הנוכחיות',

    hintRect: 'גררו כדי לשרטט מלבן',
    hintLasso: 'גררו כדי לשרטט קו חופשי',
    hintPoly: 'לחצו כדי להוסיף פינות · לחיצה כפולה או Enter לסגירה · Esc לביטול',
    hintPolyCount: 'לחצו כדי להוסיף פינות · {n} עד כה',
    hintPolyClose: 'לחיצה כפולה, Enter, או לחיצה על הפינה הראשונה כדי לסגור',

    copied: 'הועתק',
    copyManually: 'העתיקו משורת הכתובת',

    scopeAll: 'כל היישובים בארץ',
    scopeRect: 'בתוך המלבן',
    scopePoly: 'בתוך האזור המסומן',
    zoomToSelection: 'התמקדות בבחירה',
    editHint: 'גררו {corner} פינה כדי לשנות את הצורה, או את {centre} המרכז כדי להזיז את כל הבחירה.',
    resizeTitle: 'גררו כדי לשנות גודל',
    reshapeTitle: 'גררו כדי לשנות את הצורה',
    moveTitle: 'גררו כדי להזיז את כל הבחירה',

    peopleCount: 'תושבים · {places}',
    onePlace: 'יישוב אחד',
    manyPlaces: '{n} יישובים',
    shareOfCountry: '{share} מתוך {total} בכל הארץ',

    composition: 'הרכב',
    colGroup: 'קבוצה',
    colPeople: 'נפשות',
    colShare: 'אחוז',
    total: 'סך הכל',

    localities: 'יישובים',
    listCount: '({n}, מהגדול לקטן)',
    colName: 'שם',
    colTotal: 'סך הכל',
    colJews: 'יהודים ואחרים',
    colArabs: 'ערבים',
    colForeign: 'זרים',
    listEmpty: 'אין יישובים בתוך הבחירה',
    listNote: 'מוצגים {cap} היישובים הגדולים מתוך {n}. הסכומים שלמעלה וקובץ ה-CSV כוללים את כולם.',
    downloadCsv: 'הורדת CSV',

    legendLargest: 'הקבוצה הגדולה:',
    legendSizes: '10 אלף · 100 אלף · מיליון תושבים',
    tipTotal: 'סך הכל',

    noData: 'אין נתונים',
    loadError: 'לא ניתן לטעון את הנתונים — {message}',
    source: 'מקור: הלשכה המרכזית לסטטיסטיקה, <a href="{url}" target="_blank" rel="noopener"><em>יישובים בישראל</em></a> — הקובץ הסופי לשנת 2023. יישובים שהלמ״ס אינה מפרסמת את נתוניהם אינם כלולים. כל יישוב מיוצג בנקודה אחת (נקודת הציון שלו בלמ״ס), ולכן הוא נספר במלואו או כלל לא.'
  }
};
