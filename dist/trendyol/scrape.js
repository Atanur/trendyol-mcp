export function scrapeFilterGroups() {
    const groups = Array.from(document.querySelectorAll('div.aggregation'));
    const result = [];
    for (const group of groups) {
        const title = (group.querySelector('.aggregation-header h3')?.textContent ?? '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!title)
            continue;
        const collapsed = group.classList.contains('collapsed');
        const options = Array.from(group.querySelectorAll('.checkbox-list-item .checkbox-label, .checkbox-list-item'))
            .map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim())
            .filter(Boolean);
        result.push({ title, collapsed, options: Array.from(new Set(options)).slice(0, 300) });
    }
    return result;
}
export function scrapeProducts(limit) {
    const PRICE_RE = /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*(?:TL|₺)/;
    const SCUFFIX_RE = /\s+\d{5,}(?:[-/][A-Za-z0-9]+)*\s*$/;
    const NOISE = [
        /hızlı bakış/gi,
        /en çok[^!]{0,40}?ürün/gi,
        /\p{Extended_Pictographic}/gu,
        /son \d+ günde[^!]*!/gi,
        /\d+\s*günde/gi,
        /(?:[\d.,]+\s*[kbm]?)?\s*kişi ekledi!?/gi,
        /(?:[\d.,]+\s*[kbm]?)?\s*kişi favoriledi!?/gi,
        /trendyol plus'?[a-zçğıöşü]*\s*[Öö]zel/gi,
        /trendyol plus ile/gi,
        /sepette\s*%?\s*\d*\s*[İIi]ndirim/gi,
        /çok al az öde/gi,
        /kargo bedava/gi,
        /-%\s?\d+/g,
        /[\d.,]*\s*(?:tl|₺)/gi,
        /\(\s*\d{1,6}\s*\)/g,
        /\(?\d+[.,]\d+\)?/g,
    ];
    const anchors = Array.from(document.querySelectorAll('a[href*="-p-"]'));
    const out = [];
    const seen = new Set();
    const text = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const cleanTitle = (raw, brand) => {
        let value = raw.replace(/\s+/g, ' ').trim();
        for (const pattern of NOISE)
            value = value.replace(pattern, ' ');
        value = value.replace(/\s+/g, ' ').trim();
        if (brand) {
            const index = value.toLocaleLowerCase('tr-TR').indexOf(brand.toLocaleLowerCase('tr-TR'));
            if (index > 0)
                value = value.slice(index);
            const lower = value.toLocaleLowerCase('tr-TR');
            if (lower.startsWith(brand.toLocaleLowerCase('tr-TR'))) {
                value = value.slice(brand.length).trim();
            }
        }
        value = value.replace(SCUFFIX_RE, '').trim();
        value = value.replace(/\s*[,;•|]+\s*/g, ' ');
        value = value.replace(/^[\s,.;:•\-–]+/, '').replace(/[\s,.;:•\-–]+$/, '');
        value = value.replace(/[-–:]\s*$/, '').replace(/\s+/g, ' ').trim();
        return value;
    };
    const pickPrice = (card, regex) => {
        const selectors = [
            '[class*="single-price" i]',
            '[class*="promo-price-value" i]',
            '[class*="discounted-price" i]',
            '[class*="price-value" i]',
            '[class*="price-section" i]',
            '[class*="price" i]',
        ];
        for (const selector of selectors) {
            const el = card.querySelector(selector);
            if (!el)
                continue;
            const cleaned = text(el)
                .replace(/-?%\s?\d{1,3}\b/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            const match = cleaned.match(regex);
            if (match)
                return match[0].replace(/\s+/g, ' ').trim();
        }
        return undefined;
    };
    const cardFor = (anchor) => {
        let card = anchor;
        let best = anchor;
        for (let depth = 0; depth < 8 && card.parentElement; depth += 1) {
            card = card.parentElement;
            const anchorCount = card.querySelectorAll('a[href*="-p-"]').length;
            if (anchorCount > 1)
                break;
            best = card;
        }
        return best;
    };
    for (const anchor of anchors) {
        const url = anchor.href;
        if (!url || seen.has(url))
            continue;
        // Skip sponsored / seller-store slider widgets and native ads.
        if (anchor.closest('.seller-store-widget, .slider-wrapper, .css-slider, .css-slide, [class*="carousel" i], [class*="sponsored" i], [class*="native-ad" i]')) {
            continue;
        }
        const card = cardFor(anchor);
        const cardText = (card.textContent ?? '').replace(/\s+/g, ' ').trim();
        const fallbackPrice = cardText.match(PRICE_RE);
        if (!fallbackPrice)
            continue;
        seen.add(url);
        const brand = text(card.querySelector('strong.product-brand, .product-brand, [class*="product-brand" i]'));
        const price = pickPrice(card, PRICE_RE) ?? fallbackPrice[0].replace(/\s+/g, ' ').trim();
        const strikeEl = card.querySelector('[class*="strike" i], [class*="original-price" i], [class*="old-price" i]');
        const originalPrice = strikeEl ? text(strikeEl).match(PRICE_RE)?.[0]?.replace(/\s+/g, ' ').trim() : undefined;
        const anchorText = text(anchor);
        let rawTitle = anchor.getAttribute('title')?.trim() || anchorText;
        if (!rawTitle || rawTitle.length < 3) {
            const heading = card.querySelector('[class*="product-name" i], [class*="cntnr-name" i], h2, h3, [class*="name" i]');
            rawTitle = text(heading) || rawTitle;
        }
        const title = cleanTitle(rawTitle, brand && brand.length <= 60 ? brand : undefined);
        const ratingText = text(card.querySelector('[class*="average-rating" i]'));
        const rating = Number.parseFloat(ratingText.replace(',', '.'));
        const reviewText = text(card.querySelector('[class*="review-count" i], [class*="reviewCount" i]'));
        const reviewMatch = reviewText.match(/(\d{1,6})/);
        const reviews = reviewMatch ? Number.parseInt(reviewMatch[1], 10) : undefined;
        const badges = [];
        card
            .querySelectorAll('.hierarchical-badge, .simplified-badge-text, [class*="promotion-label-text" i], [class*="badge-text" i]')
            .forEach((el) => {
            const badge = text(el);
            if (badge && badge.length <= 45 && !badges.includes(badge))
                badges.push(badge);
        });
        const img = card.querySelector('img');
        const image = img?.getAttribute('src') ?? img?.getAttribute('data-src') ?? undefined;
        out.push({
            title: title.slice(0, 200),
            url,
            price,
            originalPrice,
            brand: brand && brand.length <= 60 ? brand : undefined,
            rating: Number.isFinite(rating) && rating > 0 && rating <= 5 ? rating : undefined,
            reviews,
            image: image ?? undefined,
            badges: badges.length ? badges.slice(0, 5) : undefined,
        });
        if (out.length >= limit)
            break;
    }
    return out;
}
export function scrapeProductDetail() {
    const PRICE_RE = /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*(?:TL|₺)/;
    const text = (selector) => {
        const el = document.querySelector(selector);
        const value = el?.textContent?.replace(/\s+/g, ' ').trim();
        return value || undefined;
    };
    const title = text('h1') ?? text('[class*="product-name" i]') ?? document.title;
    const priceSelectors = ['[class*="single-price" i]', '[class*="price" i]'];
    let price;
    for (const selector of priceSelectors) {
        const el = document.querySelector(selector);
        const match = el?.textContent?.match(PRICE_RE);
        if (match) {
            price = match[0].replace(/\s+/g, ' ').trim();
            break;
        }
    }
    const strikeEl = document.querySelector('[class*="strike" i], [class*="original-price" i]');
    const originalPrice = strikeEl?.textContent?.match(PRICE_RE)?.[0]?.replace(/\s+/g, ' ').trim();
    const ratingText = text('[class*="average-rating" i], [class*="rating-score" i], [class*="ratingScore" i], [class*="rating" i]');
    let rating = ratingText ? Number.parseFloat(ratingText.replace(',', '.')) : undefined;
    if (!Number.isFinite(rating) || rating <= 0 || rating > 5) {
        const bodyMatch = (document.body.innerText ?? '').match(/\b([0-5][.,]\d)\b\s*(?:\/\s*5)?/);
        rating = bodyMatch ? Number.parseFloat(bodyMatch[1].replace(',', '.')) : undefined;
    }
    const reviewText = text('[class*="review-count" i], [class*="reviewCount" i], [class*="comment-count" i], [class*="değerlendir" i]');
    let reviews = reviewText ? Number.parseInt(reviewText.match(/(\d{1,7})/)?.[1] ?? '', 10) : undefined;
    if (!Number.isFinite(reviews)) {
        const bodyMatch = (document.body.innerText ?? '').match(/([\d.,]+)\s*(?:değerlendirme|yorum)/i);
        reviews = bodyMatch ? Number.parseInt(bodyMatch[1].replace(/\./g, ''), 10) : undefined;
    }
    const seller = (() => {
        const candidates = [
            'a[href*="/magaza/"]',
            '[class*="merchant-name" i]',
            '[class*="seller-name" i]',
            '[class*="merchant" i] [class*="name" i]',
        ];
        for (const selector of candidates) {
            const el = document.querySelector(selector);
            const value = (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
            if (value && value.length >= 2 && value.length <= 50 && !/TL|₺|\d{4,}/.test(value) && !/ürünün/i.test(value)) {
                return value;
            }
        }
        return undefined;
    })();
    const sellerRatingText = text('[class*="merchant" i] [class*="rating" i], [class*="seller" i] [class*="rating" i]');
    const sellerRating = sellerRatingText
        ? Number.parseFloat(sellerRatingText.replace(',', '.'))
        : undefined;
    const brand = (() => {
        const candidates = [
            'a[href*="/marka/"]',
            'strong.product-brand',
            '.product-brand',
            '[class*="product-brand" i]',
            '[class*="brand-name" i]',
        ];
        for (const selector of candidates) {
            const el = document.querySelector(selector);
            const value = (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
            if (value && value.length >= 2 && value.length <= 40 && !/TL|₺|\d{4,}/.test(value))
                return value;
        }
        return undefined;
    })();
    const collectVariants = (keywords) => {
        const map = new Map();
        const containers = Array.from(document.querySelectorAll('[class*="variant" i], [class*="option" i], [class*="size" i], [class*="color" i]'));
        for (const container of containers) {
            for (const el of Array.from(container.querySelectorAll('button, a, div, span, li'))) {
                const raw = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
                if (!raw || raw.length > 22)
                    continue;
                if (/tablo|tablosu|rehber|guide|öneri/i.test(raw))
                    continue;
                const label = raw.replace(/^(beden|bedeni|renk|renkler|color|size)\s*:?\s*/i, '').trim();
                if (!label || label.length > 18)
                    continue;
                const cls = typeof el.className === 'string' ? el.className : '';
                const attrs = `${cls} ${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('title') ?? ''}`.toLowerCase();
                if (keywords.length && !keywords.some((k) => attrs.includes(k)))
                    continue;
                const available = !el.hasAttribute('disabled') &&
                    !el.getAttribute('aria-disabled')?.includes('true') &&
                    !/disabled|soldout|out-of-stock/.test(cls);
                const selected = /selected|active|checked/.test(cls);
                const existing = map.get(label);
                map.set(label, {
                    label,
                    available: available || (existing?.available ?? false),
                    selected: selected || (existing?.selected ?? false),
                });
            }
        }
        return [...map.values()].slice(0, 40);
    };
    const sizes = collectVariants(['size', 'beden', 'variant']);
    const colors = collectVariants(['color', 'renk']);
    const images = Array.from(new Set(Array.from(document.querySelectorAll('img'))
        .map((img) => img.getAttribute('src') ?? img.getAttribute('data-src') ?? '')
        .filter((src) => /(prod\/|_org)/.test(src) &&
        !src.endsWith('.svg') &&
        !/sticker|sfweb|logo|search_|top-ranking|flag/i.test(src)))).slice(0, 8);
    const description = text('[class*="description" i], [class*="detail" i]')?.slice(0, 1500);
    const attributes = [];
    const specs = {};
    const elemText = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    document
        .querySelectorAll('.attributes .attribute-item, [data-testid="attribute-item"]')
        .forEach((item) => {
        const name = elemText(item.querySelector('.name'));
        const value = elemText(item.querySelector('.value'));
        if (!name || !value)
            return;
        attributes.push({ name, value });
        specs[name] = value;
    });
    const fit = (() => {
        const fromSpec = specs['Kalıp'];
        if (fromSpec && !/belirtilmemiş/i.test(fromSpec))
            return fromSpec;
        const match = title?.match(/(slim fit|regular fit|oversize|super slim|loose|wide leg|skinny|straight|mum fit|relaxed|comfort|oversize fit|normal kalıp)/i);
        return match?.[1];
    })();
    const fabricComposition = (() => {
        const source = specs['Materyal Bileşeni'] ?? specs['Materyal'] ?? '';
        const parts = source.split(/[,/]/);
        const result = [];
        for (const part of parts) {
            const match = part.match(/%?\s*(\d{1,3})\s*([A-Za-zÇĞİÖŞÜçğıöşü]+)/);
            if (match)
                result.push({ material: match[2].trim(), percent: Number.parseInt(match[1], 10) });
            else {
                const word = part.replace(/[%\d]/g, '').trim();
                if (word.length > 2)
                    result.push({ material: word });
            }
        }
        return result.length ? result : undefined;
    })();
    const modelHeight = (() => {
        const haystack = `${description ?? ''} ${document.body.innerText ?? ''}`;
        const match = haystack.match(/(?:model(?:in)?\s*(?: boyu| boy| yüksekliği| height)?)\D{0,12}?(\d{2,3})\s*(?:cm|CM|Cm)/);
        if (match)
            return Number.parseInt(match[1], 10);
        const fromSpec = specs['Model Boyu'] ?? specs['Modelin Boyu'];
        return fromSpec ? Number.parseInt(fromSpec.replace(/\D/g, ''), 10) || undefined : undefined;
    })();
    const cargo = [];
    document.querySelectorAll('[class*="cargo" i], [class*="delivery" i], [class*="kargo" i]').forEach((el) => {
        const value = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (value && value.length <= 60 && !cargo.includes(value))
            cargo.push(value);
    });
    const badges = [];
    document.querySelectorAll('[class*="badge-text" i], .simplified-badge-text, [class*="promotion-label-text" i]').forEach((el) => {
        const value = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (value && value.length <= 45 && !badges.includes(value))
            badges.push(value);
    });
    const returnInfo = (() => {
        const body = document.body.innerText ?? '';
        const match = body.match(/(\d{1,3}\s*gün\s*içinde\s*iade[^.\n]{0,60}|iade\s*edilemez|değişim[^.\n]{0,40})/i);
        return match?.[1]?.replace(/\s+/g, ' ').trim();
    })();
    const lowest10d = (() => {
        const lines = (document.body.innerText ?? '')
            .split('\n')
            .map((l) => l.replace(/\s+/g, ' ').trim())
            .filter(Boolean);
        const idx = lines.findIndex((l) => /en düşük fiyat/i.test(l));
        if (idx < 0)
            return { label: undefined, value: undefined };
        for (let i = idx + 1; i < Math.min(idx + 4, lines.length); i += 1) {
            const match = lines[i].match(/(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*(?:TL|₺)/);
            if (match)
                return { label: lines[idx], value: match[0].replace(/\s+/g, ' ').trim() };
        }
        return { label: lines[idx], value: undefined };
    })();
    return {
        url: location.href,
        title,
        brand,
        price,
        originalPrice,
        rating: Number.isFinite(rating) ? rating : undefined,
        reviews: Number.isFinite(reviews) ? reviews : undefined,
        seller,
        sellerRating: Number.isFinite(sellerRating) ? sellerRating : undefined,
        fit,
        fabric: specs['Materyal Bileşeni'] ?? specs['Materyal'],
        fabricType: specs['Kumaş Tipi'],
        color: specs['Renk'],
        pattern: specs['Desen'],
        modelHeight,
        fabricComposition,
        sizes: sizes.length ? sizes : undefined,
        colors: colors.length ? colors : undefined,
        images,
        description,
        attributes: attributes.length ? attributes.slice(0, 40) : undefined,
        specs: Object.keys(specs).length ? specs : undefined,
        cargo: cargo.length ? cargo.slice(0, 6) : undefined,
        badges: badges.length ? badges.slice(0, 6) : undefined,
        returnInfo,
        lowestPrice10d: lowest10d.value
            ? Number.parseFloat(lowest10d.value.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''))
            : undefined,
        lowestPrice10dLabel: lowest10d.label,
    };
}
export function scrapeReviews(limit) {
    const text = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const averageText = text(document.querySelector('[class*="average-rating" i]'));
    const averageRating = averageText ? Number.parseFloat(averageText.replace(',', '.')) : undefined;
    const totalText = text(document.querySelector('[class*="review-count" i], [class*="reviewCount" i], [class*="değerlendir" i], [class*="rating-count" i]'));
    const totalMatch = totalText.match(/(\d[\d.]{0,7})/);
    let totalCount = totalMatch ? Number.parseInt(totalMatch[1].replace(/\./g, ''), 10) : undefined;
    const aiSummary = Array.from(document.querySelectorAll('.ai-review-summary-bullet'))
        .map((el) => text(el))
        .filter((value) => value.length > 10)
        .slice(0, 8);
    const cards = Array.from(document.querySelectorAll('.review-review'));
    const reviews = [];
    const distribution = {};
    for (const card of cards) {
        const comment = text(card.querySelector('.comment-comment')) || text(card.querySelector('[class*="comment" i]'));
        if (!comment || comment.length < 3)
            continue;
        const ratingRaw = text(card.querySelector('.card-star-count, .card-rating-text, [class*="rating" i]'));
        const ratingMatch = ratingRaw.match(/([1-5](?:[.,]\d)?)/);
        let rating = ratingMatch ? Number.parseFloat(ratingMatch[1].replace(',', '.')) : undefined;
        if (rating === undefined) {
            const fullStars = card.querySelectorAll('.star-rating-full-star').length;
            if (fullStars >= 1 && fullStars <= 5)
                rating = fullStars;
        }
        if (rating !== undefined)
            distribution[String(Math.round(rating))] = (distribution[String(Math.round(rating))] ?? 0) + 1;
        const attrs = {};
        card.querySelectorAll('.product-attribute-label').forEach((labelEl) => {
            const label = text(labelEl).replace(/:$/, '');
            const value = text(labelEl.nextElementSibling);
            if (label && value)
                attrs[label.toLocaleLowerCase('tr-TR')] = value;
        });
        const headerText = text(card.querySelector('.review-content-header, .review-header'));
        const dateMatch = headerText.match(/(\d{1,2}\s+[A-Za-zÇĞİÖŞÜçğıöşü]+\s+\d{4}|\d{1,2}[./]\d{1,2}[./]\d{2,4})/);
        reviews.push({
            rating,
            text: comment.slice(0, 900),
            author: text(card.querySelector('[class*="user" i] .name, [class*="review-user" i], .card-user-name')) || undefined,
            date: dateMatch?.[1],
            size: attrs['beden'],
            likes: (() => {
                const likeText = text(card.querySelector('.i-review-like, [class*="like" i]'));
                const match = likeText.match(/(\d{1,5})/);
                return match ? Number.parseInt(match[1], 10) : undefined;
            })(),
            sellerReply: text(card.querySelector('.review-merchant-info, [class*="merchant-reply" i]')) || undefined,
        });
        if (reviews.length >= limit)
            break;
    }
    if (totalCount === undefined && reviews.length > 0)
        totalCount = undefined;
    const ratedReviews = reviews.map((r) => r.rating).filter((r) => r !== undefined);
    const computedAverage = ratedReviews.length
        ? ratedReviews.reduce((a, b) => a + b, 0) / ratedReviews.length
        : undefined;
    const stop = new Set([
        've', 'ile', 'bir', 'bu', 'çok', 'daha', 'için', 'ama', 'ancak', 'gibi', 'kadar', 'the', 'and',
        'ürün', 'ürünü', 'güzel', 'kargo', 'beden', 'oldukça', 'tam', 'ben', 'oldu', 'olarak', 'yorum',
    ]);
    const counts = new Map();
    for (const review of reviews) {
        for (const word of review.text.toLocaleLowerCase('tr-TR').split(/[^\p{L}]+/u)) {
            if (word.length < 4 || stop.has(word))
                continue;
            counts.set(word, (counts.get(word) ?? 0) + 1);
        }
    }
    const keywords = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([word, count]) => ({ word, count }));
    return {
        url: location.href,
        averageRating: Number.isFinite(averageRating)
            ? averageRating
            : computedAverage !== undefined
                ? Number(computedAverage.toFixed(1))
                : undefined,
        totalCount,
        distribution: Object.keys(distribution).length ? distribution : undefined,
        aiSummary: aiSummary.length ? aiSummary : undefined,
        reviews,
        keywords,
    };
}
//# sourceMappingURL=scrape.js.map