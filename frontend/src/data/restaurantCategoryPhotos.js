/**
 * One photo per restaurant category, for the category tiles on /restaurants
 * (Tzvi, 8 Oct 2026: "high end and really clean", like adr.it's food tiles).
 *
 * Free stock photos (Unsplash licence: commercial use, no credit required),
 * each checked to be kosher-appropriate (no cheese with meat, no shellfish,
 * no pork), with the background removed and replaced by one cream colour on
 * Cloudinary so the set reads as one shoot. A missing key falls back to the
 * category's icon.
 */
const RESTAURANT_CATEGORY_PHOTOS = {
  meat_grill: 'https://res.cloudinary.com/dirvyboe9/image/upload/e_background_removal/e_trim/c_pad,w_400,h_400,b_rgb:F6EDE3/c_pad,w_480,h_480,b_rgb:F6EDE3/q_auto,f_auto/v1791509447/myisraelrental/restaurant-categories/meat_grill', // Unsplash QoOCbD4eb8k, Nima Naseri
  sushi_asian: 'https://res.cloudinary.com/dirvyboe9/image/upload/e_background_removal/e_trim/c_pad,w_400,h_400,b_rgb:F6EDE3/c_pad,w_480,h_480,b_rgb:F6EDE3/q_auto,f_auto/v1791509448/myisraelrental/restaurant-categories/sushi_asian', // Unsplash 8nFtscE1D_w, David Foodphototasty
  cafe: 'https://res.cloudinary.com/dirvyboe9/image/upload/e_background_removal/e_trim/c_pad,w_400,h_400,b_rgb:F6EDE3/c_pad,w_480,h_480,b_rgb:F6EDE3/q_auto,f_auto/v1791509299/myisraelrental/restaurant-categories/cafe', // Unsplash ZLqxSzvVr7I, Dani
  bakery: 'https://res.cloudinary.com/dirvyboe9/image/upload/e_background_removal/e_trim/c_pad,w_400,h_400,b_rgb:F6EDE3/c_pad,w_480,h_480,b_rgb:F6EDE3/q_auto,f_auto/v1791509300/myisraelrental/restaurant-categories/bakery', // Unsplash x8UjYjIRDRs, Tetiana Shyshkina
  dessert: 'https://res.cloudinary.com/dirvyboe9/image/upload/e_background_removal/e_trim/c_pad,w_400,h_400,b_rgb:F6EDE3/c_pad,w_480,h_480,b_rgb:F6EDE3/q_auto,f_auto/v1791509302/myisraelrental/restaurant-categories/dessert', // Unsplash Nag3E3yzygU, Rosa Rafael
  shawarma_falafel: 'https://res.cloudinary.com/dirvyboe9/image/upload/e_background_removal/e_trim/c_pad,w_400,h_400,b_rgb:F6EDE3/c_pad,w_480,h_480,b_rgb:F6EDE3/q_auto,f_auto/v1791509303/myisraelrental/restaurant-categories/shawarma_falafel', // Unsplash 1k-7E0jueTA, lrsflx
  hummus: 'https://res.cloudinary.com/dirvyboe9/image/upload/e_background_removal/e_trim/c_pad,w_400,h_400,b_rgb:F6EDE3/c_pad,w_480,h_480,b_rgb:F6EDE3/q_auto,f_auto/v1791509304/myisraelrental/restaurant-categories/hummus', // Unsplash I593oW2OKjI, Cosmin Ursea
  deli: 'https://res.cloudinary.com/dirvyboe9/image/upload/e_background_removal/e_trim/c_pad,w_400,h_400,b_rgb:F6EDE3/c_pad,w_480,h_480,b_rgb:F6EDE3/q_auto,f_auto/v1791509304/myisraelrental/restaurant-categories/deli', // Unsplash kjRBBd3qZ1M, Akhil Pawar
  breakfast: 'https://res.cloudinary.com/dirvyboe9/image/upload/e_background_removal/e_trim/c_pad,w_400,h_400,b_rgb:F6EDE3/c_pad,w_480,h_480,b_rgb:F6EDE3/q_auto,f_auto/v1791509454/myisraelrental/restaurant-categories/breakfast', // Unsplash K9oKpOebg84, amirali mirhashemian
  fish: 'https://res.cloudinary.com/dirvyboe9/image/upload/e_background_removal/e_trim/c_pad,w_400,h_400,b_rgb:F6EDE3/c_pad,w_480,h_480,b_rgb:F6EDE3/q_auto,f_auto/v1791509499/myisraelrental/restaurant-categories/fish', // Unsplash CWUpnRTlXB0, Kostiantyn Vierkieiev
  steakhouse: 'https://res.cloudinary.com/dirvyboe9/image/upload/e_background_removal/e_trim/c_pad,w_400,h_400,b_rgb:F6EDE3/c_pad,w_480,h_480,b_rgb:F6EDE3/q_auto,f_auto/v1791509501/myisraelrental/restaurant-categories/steakhouse', // Unsplash p0Y3ahmsh0M, Dima Solomin
};

export default RESTAURANT_CATEGORY_PHOTOS;
