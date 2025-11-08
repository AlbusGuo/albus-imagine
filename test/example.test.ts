describe("Example Test Suite", () => {
	it("should pass a simple test", () => {
		const result = 1 + 1;
		expect(result).toBe(2);
	});

	it("should fail a simple test", () => {
		const result = 1 + 1;
		expect(result).toBe(3); // This will fail
	});
});
