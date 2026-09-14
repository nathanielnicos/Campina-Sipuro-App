const employee = require('./employeeController');
const customerUser = require('./customerUserController');
const product = require('./productController');
const price = require('./priceController');

module.exports = {
    getAllEmployees: employee.getAllEmployees,
    toggleEmployeeStatus: employee.toggleEmployeeStatus,

    getAllCustomerUsers: customerUser.getAllCustomerUsers,
    toggleCustomerUserStatus: customerUser.toggleCustomerUserStatus,

    getAllProducts: product.getAllProducts,

    getAllPrices: price.getAllPrices
}
