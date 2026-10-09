/**
 * One photo per restaurant category, for the category tiles on /restaurants
 * (Tzvi, 8 Oct 2026: "high end and really clean", like adr.it's food tiles).
 *
 * Generated as ONE set (Higgsfield, z_image, one style preamble reused word
 * for word): same angle, same light from the left, same very light cream
 * backdrop, the dish filling the frame. A first attempt with 14 stock photos
 * cut out onto cream looked cheap next to the reference, which is now a page
 * rule ("A set of images reads as one shoot", page-generation-rules section 8).
 * Every image was checked to be kosher-appropriate: no meat with cheese or
 * cream, no shellfish, no pork. Naming what to avoid in a prompt tended to
 * add it (the sushi came back with shrimp); describe only what is wanted.
 * A missing key falls back to the category's icon.
 */
const RESTAURANT_CATEGORY_PHOTOS = {
  pizza: 'https://res.cloudinary.com/dirvyboe9/image/upload/c_fill,w_480,h_480/q_auto,f_auto/v1791512202/myisraelrental/restaurant-categories/pizza',
  burgers: 'https://res.cloudinary.com/dirvyboe9/image/upload/c_fill,w_480,h_480/q_auto,f_auto/v1791512204/myisraelrental/restaurant-categories/burgers',
  meat_grill: 'https://res.cloudinary.com/dirvyboe9/image/upload/c_fill,w_480,h_480/q_auto,f_auto/v1791512205/myisraelrental/restaurant-categories/meat_grill',
  sushi_asian: 'https://res.cloudinary.com/dirvyboe9/image/upload/c_fill,w_480,h_480/q_auto,f_auto/v1791512207/myisraelrental/restaurant-categories/sushi_asian',
  cafe: 'https://res.cloudinary.com/dirvyboe9/image/upload/c_fill,w_480,h_480/q_auto,f_auto/v1791512209/myisraelrental/restaurant-categories/cafe',
  bakery: 'https://res.cloudinary.com/dirvyboe9/image/upload/c_fill,w_480,h_480/q_auto,f_auto/v1791512210/myisraelrental/restaurant-categories/bakery',
  dairy_italian: 'https://res.cloudinary.com/dirvyboe9/image/upload/c_fill,w_480,h_480/q_auto,f_auto/v1791512212/myisraelrental/restaurant-categories/dairy_italian',
  dessert: 'https://res.cloudinary.com/dirvyboe9/image/upload/c_fill,w_480,h_480/q_auto,f_auto/v1791512213/myisraelrental/restaurant-categories/dessert',
  shawarma_falafel: 'https://res.cloudinary.com/dirvyboe9/image/upload/c_fill,w_480,h_480/q_auto,f_auto/v1791512215/myisraelrental/restaurant-categories/shawarma_falafel',
  hummus: 'https://res.cloudinary.com/dirvyboe9/image/upload/c_fill,w_480,h_480/q_auto,f_auto/v1791512217/myisraelrental/restaurant-categories/hummus',
  deli: 'https://res.cloudinary.com/dirvyboe9/image/upload/c_fill,w_480,h_480/q_auto,f_auto/v1791512218/myisraelrental/restaurant-categories/deli',
  breakfast: 'https://res.cloudinary.com/dirvyboe9/image/upload/c_fill,w_480,h_480/q_auto,f_auto/v1791512220/myisraelrental/restaurant-categories/breakfast',
  fish: 'https://res.cloudinary.com/dirvyboe9/image/upload/c_fill,w_480,h_480/q_auto,f_auto/v1791512221/myisraelrental/restaurant-categories/fish',
  steakhouse: 'https://res.cloudinary.com/dirvyboe9/image/upload/c_fill,w_480,h_480/q_auto,f_auto/v1791512223/myisraelrental/restaurant-categories/steakhouse',
};

export default RESTAURANT_CATEGORY_PHOTOS;
