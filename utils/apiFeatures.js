class APIFeatures {
  constructor(query, queryStr) {
    this.query = query;
    this.queryStr = queryStr;
  }

  search() {
    const searchVal = this.queryStr.keyword || this.queryStr.search;
    const keyword = searchVal
      ? {
          $or: [
            { name: { $regex: searchVal, $options: 'i' } },
            { description: { $regex: searchVal, $options: 'i' } },
            { tags: { $regex: searchVal, $options: 'i' } },
          ],
        }
      : {};

    this.query = this.query.find({ ...keyword });
    return this;
  }

  filter() {
    const queryCopy = { ...this.queryStr };

    // Fields to remove from simple query matching
    const removeFields = ['keyword', 'search', 'page', 'limit', 'sort'];
    removeFields.forEach((el) => delete queryCopy[el]);

    // Handle specific e-commerce custom price filters minPrice & maxPrice
    const priceFilter = {};
    if (queryCopy.minPrice !== undefined && queryCopy.minPrice !== '') {
      priceFilter.$gte = Number(queryCopy.minPrice);
      delete queryCopy.minPrice;
    }
    if (queryCopy.maxPrice !== undefined && queryCopy.maxPrice !== '') {
      priceFilter.$lte = Number(queryCopy.maxPrice);
      delete queryCopy.maxPrice;
    }

    if (Object.keys(priceFilter).length > 0) {
      queryCopy.discountPrice = priceFilter;
    }

    // Convert comparison operators (gte, gt, lte, lt) to MongoDB syntax
    let queryStr = JSON.stringify(queryCopy);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

    this.query = this.query.find(JSON.parse(queryStr));
    return this;
  }

  sort() {
    if (this.queryStr.sort) {
      const sortBy = this.queryStr.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }
    return this;
  }

  paginate(defaultLimit = 12) {
    const page = Number(this.queryStr.page) || 1;
    const limit = Number(this.queryStr.limit) || defaultLimit;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);
    return this;
  }
}

export default APIFeatures;
