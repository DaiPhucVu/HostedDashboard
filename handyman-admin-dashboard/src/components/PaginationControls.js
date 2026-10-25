import React from "react";
import { Button } from "react-bootstrap";

const PaginationControls = ({
  totalItems = 0,
  entriesPerPage = 10,
  setEntriesPerPage,
  currentPage = 1,
  setCurrentPage,
  startIndex,
}) => {
  const totalPages = entriesPerPage > 0 ? Math.ceil(totalItems / entriesPerPage) : 0;

  // If there are no pages (no items), don't render anything
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="d-flex justify-content-center align-items-center mt-4">
      <div className="d-flex align-items-center gap-3 flex-wrap">

        {/* ---Previous Button--- */}
        <Button
          variant={currentPage > 1 ? "outline-primary" : "outline-secondary"}
          onClick={() => setCurrentPage(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          &lsaquo; Previous
        </Button>

        {/* ---Page Numbers--- */}
        {[...Array(totalPages)].map((_, index) => {
          const page = index + 1;

          // Show nearby pages + first and last
          if (
            Math.abs(currentPage - page) > 2 &&
            page !== 1 &&
            page !== totalPages
          ) {
            if (page === 2 || page === totalPages - 1) {
              return (
                <span key={page} className="text-muted">
                  ...
                </span>
              );
            }
            return null;
          }

          return (
            <Button
              key={page}
              variant={page === currentPage ? "primary" : "link"}
              className={`text-decoration-none px-2 ${
                page === currentPage
                  ? "text-white fw-semibold rounded"
                  : "text-dark"
              }`}
              onClick={() => setCurrentPage(page)}
            >
              {String(page).padStart(2, "0")}
            </Button>
          );
        })}

        {/* ---Next Button--- */}
        <Button
          variant={currentPage < totalPages ? "outline-primary" : "outline-secondary"}
          onClick={() => setCurrentPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          Next &rsaquo;
        </Button>

      </div>
    </div>
  );
};

export default PaginationControls;
