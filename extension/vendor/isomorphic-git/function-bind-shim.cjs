// Chrome 120+ always provides native Function.prototype.bind. Using it directly
// avoids the dependency's legacy dynamic-Function fallback, which MV3 forbids.
module.exports = Function.prototype.bind;
