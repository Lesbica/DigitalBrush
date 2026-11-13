// Options shared by the upload forms and the list filters, so a filter always matches stored values.
export const STYLES = [
    'Retro Futurism', 'Mid-Century', 'Modern, Art Deco', 'Bauhaus, Y2K', 'Aesthetic', 'Memphis Style',
    'Grunge', 'Psychedelic Art', 'Surrealism, Neo-Psychedelia, Op Art', 'Dreamcore', 'Weirdcore',
    'Hyperrealism', 'Social Realism', 'Digital Realism', 'Cinematic Realism', 'Cyberpunk',
    'Synthwave', 'Vaporwave', 'Minimalism', 'Brutalism', 'Postmodern', 'Collage',
];

export const PAINTING_FORMATS = ['PNG', 'JPG', 'JPEG', 'WEBP', 'SVG'];
export const COMMISSION_FORMATS = ['PNG', 'JPG', 'SVG', 'PSD', 'AI', 'Figma'];

// "SORT BY" option -> `sort` query parameter of the list endpoints
export const SORT_PARAMS = {
    POPULAR: 'popular',
    LATEST: 'newest',
    EXPENSIVE: 'price_desc',
    CHEAP: 'price_asc',
};

const sortColumn = (names) => ({ title: 'SORT BY', options: [{ name: 'NONE' }, ...names.map(name => ({ name }))] });
const pickColumn = (title, noneLabel, values) => ({ title, options: [{ name: noneLabel, subOptions: values }] });

export const SHOP_FILTERS = [
    sortColumn(['POPULAR', 'LATEST', 'EXPENSIVE', 'CHEAP']),
    pickColumn('STYLE', 'ANY STYLE', STYLES),
];

export const COMMISSION_FILTERS = [
    sortColumn(['LATEST', 'EXPENSIVE', 'CHEAP']),
    pickColumn('STYLE', 'ANY STYLE', STYLES),
    pickColumn('FORMAT', 'ANY FORMAT', COMMISSION_FORMATS),
];

// Selected advanced filters ({ 'SORT BY': 'CHEAP', STYLE: 'Cyberpunk' }) -> query parameters
export function filtersToParams(selected) {
    return {
        sort: SORT_PARAMS[selected['SORT BY']],
        style: selected.STYLE,
        format: selected.FORMAT,
    };
}

// Click on an option: select it, or clear the column when it is already selected / "NONE"
export function toggleFilter(selected, column, value) {
    const next = { ...selected };
    if (value === 'NONE' || next[column] === value) delete next[column];
    else next[column] = value;
    return next;
}
