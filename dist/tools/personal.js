import { getWardrobe } from '../wardrobe/db.js';
import { personalizeProduct } from '../wardrobe/personalize.js';
import { profileNote } from '../wardrobe/profile.js';
/**
 * `annotatePersonal`'ın hata-güvenli hâli: kişisel işaretleme başarısız olursa (ör. bozuk veri dosyası)
 * kazıma sonuçları kaybolmasın diye hatayı değer olarak döner.
 */
export async function annotatePersonalSafe(products, options) {
    try {
        return { ok: true, ...(await annotatePersonal(products, options)) };
    }
    catch (error) {
        return { ok: false, hata: error.message };
    }
}
/** Ürün listesini kullanıcının profiline göre işaretler; sıralamayı değiştirmez. */
export async function annotatePersonal(products, options) {
    const store = getWardrobe();
    const [profile, brandFit, zevk] = await Promise.all([store.getProfile(), store.listBrandFit(), store.listZevk()]);
    const annotated = products.map((product) => ({
        ...product,
        kisisel: personalizeProduct(product, { profile, brandFit, zevk, gender: options.gender, rol: options.rol, butceMax: options.butceMax }),
    }));
    const ozet = { uygun: 0, dikkat: 0, eleme: 0 };
    for (const row of annotated)
        ozet[row.kisisel.karar] += 1;
    return { products: annotated, summary: { ozet, ...profileNote(profile) } };
}
//# sourceMappingURL=personal.js.map