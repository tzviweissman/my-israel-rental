/**
 * Every photo a product has, oldest field first.
 *
 * Products used to carry exactly one image, in a field called `image`.
 * That single slot is why a real bakery listed "Custom box of 4" twice at
 * the same price: they had a second photo of the same box and creating
 * the product again was the only way to attach it. The duplicate was
 * theirs to make, but the form left them no other move.
 *
 * `images` is the gallery now. `image` is still read, because thousands
 * of stored products have it and a migration that rewrites live records
 * is a worse trade than four lines here. A product that somehow has both
 * yields both, with the original thumbnail first so the cover a seller
 * already chose stays the cover.
 */
export const productPhotos = (product) => {
  if (!product) return [];
  const many = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  const one = product.image;
  if (!one) return many;
  return many.includes(one) ? many : [one, ...many];
};

/** The single image to show where there is only room for one. */
export const productCover = (product) => productPhotos(product)[0] || null;

export default productPhotos;
