// Arabian Shield report theme.
//
// Palette taken from the live site (der3.com) by reading computed styles, not
// guessed: rgb(0,96,47) is the nav/CTA green and rgb(129,165,63) the
// "Get a quote" lime. Those two carry the brand.
//
// Categorical series need to stay separable, so only the first two slots are
// brand greens; the rest widen into complementary corporate hues rather than
// shades of green, which would be unreadable once a chart has four series.
const BRAND = {
  green:      '#00602F',  // primary
  lime:       '#81A53F',  // accent
  greenDeep:  '#0A4A28',
  greenMid:   '#1F6035',
  ink:        '#1D1D1B',
  slate:      '#5A6470',
  mist:       '#F4F6F3',
  line:       '#E3E8E1',
  white:      '#FFFFFF',
  gold:       '#C8952B',
  red:        '#B03A2E',
};

// The brand carries the report chrome; the chart palette does not have to be
// green. Series 1-2 anchor to the brand, then the palette moves through clearly
// separated hues so four or five series on one chart stay tellable apart -
// which shades of a single green never are.
const DATA_COLORS = [
  BRAND.green,   //  1 brand deep green
  BRAND.lime,    //  2 brand lime
  '#E8A33D',     //  3 amber
  '#1B87A8',     //  4 teal blue
  '#C4553B',     //  5 terracotta
  '#6B4C9A',     //  6 violet
  '#2E9E7A',     //  7 emerald
  '#D4726A',     //  8 coral
  '#4A6FA5',     //  9 slate blue
  '#B5892E',     // 10 bronze
  '#9BBE3F',     // 11 bright olive
  '#8C5AA8',     // 12 orchid
  '#3FA9C4',     // 13 sky
  '#D98E2B',     // 14 ochre
  '#5C8A3A',     // 15 moss
  '#A0522D',     // 16 sienna
];

const solid = (c) => ({ solid: { color: c } });
const label = (size, color, bold) => [{ fontSize: size, color: solid(color), ...(bold ? { fontFamily: 'Segoe UI Semibold' } : {}) }];

module.exports = { BRAND, theme: {
  name: 'Arabian Shield',
  dataColors: DATA_COLORS,

  foreground: BRAND.ink,
  foregroundNeutralSecondary: BRAND.slate,
  foregroundNeutralTertiary: '#A7B0A9',
  foregroundNeutralLight: '#8A938C',
  background: BRAND.white,
  backgroundLight: BRAND.mist,
  backgroundNeutral: BRAND.line,
  backgroundDark: BRAND.green,
  secondaryBackground: BRAND.line,
  tableAccent: BRAND.green,
  accent: BRAND.lime,
  shapeStroke: BRAND.line,
  disabledText: '#A7B0A9',

  // KPI / conditional semantics: on-target uses the brand lime so "good" reads
  // as brand rather than generic green.
  good: BRAND.lime,
  neutral: BRAND.gold,
  bad: BRAND.red,
  maximum: BRAND.green,
  center: BRAND.gold,
  minimum: '#D8E3D2',
  null: '#F0F0F0',
  hyperlink: BRAND.green,
  visitedHyperlink: BRAND.greenDeep,

  textClasses: {
    title:     { fontFace: 'Segoe UI Semibold', fontSize: 15, color: BRAND.green },
    header:    { fontFace: 'Segoe UI Semibold', fontSize: 12, color: BRAND.ink },
    label:     { fontFace: 'Segoe UI',          fontSize: 10, color: BRAND.slate },
    callout:   { fontFace: 'Segoe UI Light',    fontSize: 32, color: BRAND.green },
    largeTitle:{ fontFace: 'Segoe UI Semibold', fontSize: 20, color: BRAND.green },
  },

  visualStyles: {
    '*': {
      '*': {
        '*': [{ wordWrap: true }],
        background: [{ show: true, color: solid(BRAND.white), transparency: 0 }],
        border: [{ show: true, color: solid(BRAND.line), radius: 6 }],
        dropShadow: [{ show: true, color: solid('#0A4A28'), position: 'Outer', preset: 'Custom',
                       shadowBlur: 8, shadowDistance: 1, transparency: 92, angle: 90 }],
        visualHeader: [{ show: true, background: solid(BRAND.white), foreground: solid(BRAND.slate),
                         border: solid(BRAND.white), transparency: 0 }],
        title: [{ show: true, fontColor: solid(BRAND.green), fontSize: 12,
                  fontFamily: 'Segoe UI Semibold', alignment: 'left', background: solid(BRAND.white) }],
        subTitle: [{ show: false }],
        categoryAxis: [{ showAxisTitle: false, fontSize: 10, labelColor: solid(BRAND.slate),
                         gridlineStyle: 'solid', gridlineColor: solid(BRAND.line), gridlineThickness: 1 }],
        valueAxis: [{ showAxisTitle: false, fontSize: 10, labelColor: solid(BRAND.slate),
                      gridlineStyle: 'solid', gridlineColor: solid(BRAND.line), gridlineThickness: 1 }],
        legend: [{ show: true, position: 'TopCenter', fontSize: 10, labelColor: solid(BRAND.slate), showTitle: false }],
        labels: [{ show: false, fontSize: 9, color: solid(BRAND.slate) }],
      },
    },

    // KPI cards carry the headline numbers: brand green callout, quiet label.
    cardVisual: {
      '*': {
        calloutValue: [{ fontSize: 26, fontFamily: 'Segoe UI Light', color: solid(BRAND.green) }],
        calloutBlock: [{ horizontalAlignment: 'left' }],
        labels: [{ fontSize: 10, fontFamily: 'Segoe UI', color: solid(BRAND.slate), horizontalAlignment: 'left' }],
        background: [{ show: true, color: solid(BRAND.white) }],
        border: [{ show: true, color: solid(BRAND.line), radius: 6 }],
        title: [{ show: false }],
      },
    },

    // Text boxes sit ON the brand band. The generic '*' style above gives every
    // visual a white card with a border and shadow, which boxed the header title
    // in white and made light-on-green text unreadable. Opt them out.
    textbox: {
      '*': {
        background: [{ show: false, transparency: 100 }],
        border: [{ show: false }],
        dropShadow: [{ show: false }],
        visualHeader: [{ show: false }],
        title: [{ show: false }],
      },
    },

    // Shapes are used for the header band; no card chrome on them either.
    shape: {
      '*': {
        background: [{ show: false, transparency: 100 }],
        border: [{ show: false }],
        dropShadow: [{ show: false }],
        visualHeader: [{ show: false }],
      },
    },

    actionButton: {
      '*': {
        background: [{ show: false, transparency: 100 }],
        dropShadow: [{ show: false }],
        visualHeader: [{ show: false }],
      },
    },

    tableEx: {
      '*': {
        grid: [{ gridVertical: false, gridHorizontal: true, gridHorizontalColor: solid(BRAND.line),
                 outlineColor: solid(BRAND.line), rowPadding: 3, textSize: 9.5 }],
        columnHeaders: [{ fontColor: solid(BRAND.white), backColor: solid(BRAND.green),
                          fontFamily: 'Segoe UI Semibold', fontSize: 9.5, alignment: 'Left', autoSizeColumnWidth: true }],
        values: [{ fontColor: solid(BRAND.ink), backColor: solid(BRAND.white),
                   backColorSecondary: solid(BRAND.mist), urlIcon: false, fontSize: 9.5 }],
        total: [{ fontColor: solid(BRAND.green), backColor: solid(BRAND.mist), fontFamily: 'Segoe UI Semibold' }],
      },
    },

    slicer: {
      '*': {
        background: [{ show: true, color: solid(BRAND.white) }],
        border: [{ show: true, color: solid(BRAND.line), radius: 6 }],
        header: [{ show: true, fontColor: solid(BRAND.green), fontFamily: 'Segoe UI Semibold', fontSize: 10.5, background: solid(BRAND.white) }],
        items: [{ fontColor: solid(BRAND.ink), background: solid(BRAND.white), fontSize: 10 }],
        selection: [{ selectAllCheckboxEnabled: true, singleSelect: false },
        ],
      },
    },

    lineChart: {
      '*': {
        lineStyles: [{ strokeWidth: 2, lineStyle: 'solid', showMarker: false }],
      },
    },

    page: {
      '*': {
        background: [{ color: solid(BRAND.mist), transparency: 0 }],
        outspace: [{ color: solid(BRAND.mist), transparency: 0 }],
      },
    },
  },
}};
