const Book = require("../../model/Book");
module.exports.getBookBySlug = async (req, res) => {
  console.log("chạy vào chương trình get slug");
  try {
    const book = await Book.findOne({
      slug: req.params.slug,
      deleted: false,
      status: "active",
    }).populate("authors");
    console.log("book là : ", book);
    if (!book) return res.status(404).json({ message: "Book not found" });
    res.json(book);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
